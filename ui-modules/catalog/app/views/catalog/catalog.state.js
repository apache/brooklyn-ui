/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import angular from 'angular';
import brIconGenerator from 'brooklyn-ui-utils/icon-generator/icon-generator';
import brooklynCatalogApi from 'brooklyn-ui-utils/providers/catalog-api.provider';
import brooklynTypeItem from '../../components/type-item/index';
import brUtils from 'brooklyn-ui-utils/utils/general';
import template from './catalog.template.html';
import {analyzeDescription} from 'brooklyn-ui-utils/md-helper';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import {CATALOG_UPLOAD_COMPLETED} from 'brooklyn-ui-utils/catalog-uploader/catalog-uploader';

const MODULE_NAME = 'catalog.state';

angular.module(MODULE_NAME, [brIconGenerator, brooklynCatalogApi, brooklynTypeItem, brUtils])
    .config(['$stateProvider', catalogStateConfig])
    .filter('bundleName', ['$sce', bundleNameFilter])
    .filter('bundleDescription', ['$sce', bundleDescriptionFilter])
    .filter('bundleHighlights', ['$sce', bundleHighlightsFilter])
    .filter('bundleTypeFilter', ['$sce', bundleTypeFilter]);

export default MODULE_NAME;

export const catalogState = {
    name: 'catalog',
    url: '/',
    template: template,
    controller: ['$scope', '$rootScope', 'catalogApi', 'brUtilsGeneral', catalogController],
    controllerAs: 'ctrl'
};

export function catalogStateConfig($stateProvider) {
    $stateProvider.state(catalogState);
}

export function catalogController($scope, $rootScope, catalogApi, brUtilsGeneral) {
    const orderBysBundles = [{
        id: 'name',
        label: 'Name'
    }, {
        id: '-version',
        label: 'Version'
    }, {
        id: '-types',
        label: 'Most types'
    }, {
        id: 'types',
        label: 'Least types'
    }];
    const orderBysTypes = [{
        id: 'displayName',
        label: 'Display name'
    }, {
        id: 'id',
        label: 'Type name'
    }, {
        id: '-version',
        label: 'Version'
    }, {
        id: 'supertypes',
        label: 'Supertype'
    }, {
        id: 'containingBundle',
        label: 'Bundle'
    }];

    const savedOrderByKey = 'catalog-order-by';

    const savedOrderBy = localStorage && localStorage.getItem(savedOrderByKey) !== null ?
        JSON.parse(localStorage.getItem(savedOrderByKey))
        : {
            orderBy: 'bundles',
            sortBy: 0
        }

    $scope.pagination = {
        page: 1, // not used
        itemsPerPage: 20  // used as an absolute limit
    };
    $scope.config = {
        orderBy: savedOrderBy.orderBy === 'bundles' ? orderBysBundles : orderBysTypes
    };
    $scope.state = {
        view: savedOrderBy.orderBy,
        versions: [],
        orderBy: $scope.config.orderBy.length > savedOrderBy.sortBy ? $scope.config.orderBy[savedOrderBy.sortBy] : 0,
        search: {}
    };

    $scope.$watch('state.view', (newView, oldView) => {
        if (newView && oldView && !angular.equals(newView, oldView)) {
            $scope.config.orderBy = newView === 'types' ? orderBysTypes : orderBysBundles;
            $scope.state.orderBy = $scope.config.orderBy[0]
            savedOrderBy.orderBy = newView;
            savedOrderBy.sortBy = 0;
            if (localStorage) {
                localStorage.setItem(savedOrderByKey, JSON.stringify(savedOrderBy));
            }
        }
    });

    $scope.$watch('state.orderBy', (newOrderBy, oldOrderBy) => {
        if(newOrderBy && oldOrderBy && !angular.equals(newOrderBy, oldOrderBy)) {
            savedOrderBy.sortBy = $scope.config.orderBy.indexOf(newOrderBy);
            if (localStorage) {
                localStorage.setItem(savedOrderByKey, JSON.stringify(savedOrderBy));
            }
        }
    });

    $scope.clearSearchFilters = () => {
        $scope.state.search = {};
        $scope.state.orderBy = orderBysBundles[0];
    };

    $scope.isNonEmpty = (o) => {
        return brUtilsGeneral.isNonEmpty(o);
    };

    $scope.launchCatalogUploader = ()=> {
        $rootScope.$broadcast('open-catalog-uploader');
    };

    function getBundles(initialLoad) {
        catalogApi.getBundles({params: {detail: true}}).then(data => {
            if (initialLoad) $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
            processBundles(data);
        });
    }
    getBundles(true);
    $scope.$on(CATALOG_UPLOAD_COMPLETED, ()=>{
        getBundles(false);
    });

    function processBundles(bundles) {
        $scope.bundles = bundles;

        $scope.versions = bundles.reduce((versions, bundle) => {
            if (!versions.hasOwnProperty(bundle.symbolicName)) {
                versions[bundle.symbolicName] = [];
            }
            versions[bundle.symbolicName].push(bundle.version);
            return versions;
        }, {});
        $scope.config.versions = Array.from(Object.values($scope.versions).reduce((set, versions) => {
            versions.forEach(version => set.add(version));
            return set;
        }, new Set()));

        $scope.types = bundles.reduce((types, bundle) => {
            let typesInBundle = angular.copy(bundle.types).map(t => {
                // record the bundle
                t.bundle = {
                    symbolicName: bundle.symbolicName,
                    version: bundle.version,
                };
                
                // tidy up display so that things labelled [DEPRECATED] don't have that ugly name
                // (since we highlight deprecated things, and particularly bad since [ appears first alphabetically!)
                // [as in bundle.state.js]
                if (t.deprecated && t.displayName.match(/^[^\w]*deprecated[^\w]*/i)) {
                    t.displayName = t.displayName.replace(/^[^\w]*deprecated[^\w]*/i, '');
                }
                
                return t;
            });
            return types.concat(typesInBundle);
        }, []);
    }
}

export function bundleNameFilter() {
    return function(input) {
        if (!input) {
            return;
        }
        // we could give better names to these unhelpful bundle names;
        // but actually doing so currently is jarring as all the other bundle names
        // are in symbolic name format and this is in display name format;
        // if we had nice bundle display names it would make much more sense to do this:
        // (reenable when we have display names for bundles)
//        if (input.symbolicName && input.symbolicName.startsWith('brooklyn-catalog-bom')) {
//            return 'Unnamed bundle';
//        }
        return input.symbolicName;
    }
}

export function bundleDescriptionFilter() {
    return function(input) {
        if (!input) {
            return;
        }
        if (input.description) {
            // bundles don't have description yet so this is moot, but when they do this will be nice - or better use the md-if-multiline widget from mdHelper
            return analyzeDescription(input).oneline;
        }

        let alwaysGenerateDefaultDescription = true;
        if (alwaysGenerateDefaultDescription || (input.symbolicName && input.symbolicName.startsWith('brooklyn-catalog-bom'))) {
            // useful in anonymous case because the name gives no clue as to the title;
            // useful in other cases too, even if redundant, but as a flag above in case we don't want to do that
            if (angular.isArray(input.types) && input.types.length > 0) {
                let displayedTypes = input.types.slice(0, input.types.length > 3 ? 2 : input.types.length);
                let description = `Composed of ${displayedTypes.map(type => type.displayName || type.symbolicName).join(', ')}`;
                if (input.types.length > displayedTypes.length) {
                    description += ` and ${input.types.length - displayedTypes.length} more items`;
                }
                return description;
            } else {
                return "This is likely a support bundle."
            }
        }
    }
}

const highlightToHTML = ({ count, labelOne, labelMany }) =>
    `<span class="highlight-count">${count}</span>&nbsp;<span class="highlight-label">${count === 1 ? labelOne : labelMany}</span>`;

export function bundleHighlightsFilter($sce) {
    return function(input) {
        let highlights = [
            { count:0, labelOne: 'entity', labelMany: 'entities' },
            { count:0, labelOne: 'policy', labelMany: 'policies' },
            { count:0, labelOne: 'enricher', labelMany: 'enrichers' },
        ];

        if (input && input.types) {
            input.types.forEach(({supertypes}) => {
                if (supertypes.includes('org.apache.brooklyn.api.entity.Entity')) highlights[0].count++;
                if (supertypes.includes('org.apache.brooklyn.api.entity.Policy')) highlights[1].count++;
                if (supertypes.includes('org.apache.brooklyn.api.sensor.Enricher')) highlights[2].count++;
            })
        }

        return $sce.trustAsHtml(highlights
            .filter(({ count }) => count)
            .map(highlightToHTML)
            .join('&nbsp;')
        );
    };
}

export function bundleTypeFilter() {
    return function(input, superType) {
        return input && input.filter(type => type.supertypes.includes(superType));
    }
}
