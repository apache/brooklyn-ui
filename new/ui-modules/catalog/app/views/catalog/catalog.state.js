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
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';

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

    $scope.pagination = {
        page: 1,
        itemsPerPage: 20
    };
    $scope.config = {
        orderBy: orderBysBundles
    };
    $scope.state = {
        view: 'bundles',
        versions: [],
        orderBy: $scope.config.orderBy[0],
        search: {}
    };

    $scope.$watch('state.view', (newView, oldView) => {
        if (newView && oldView && !angular.equals(newView, oldView)) {
            $scope.config.orderBy = newView === 'types' ? orderBysTypes : orderBysBundles;
            $scope.state.orderBy = $scope.config.orderBy[0]
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

    catalogApi.getBundles({params: {detail: true}}).then(data => {
        $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

        processBundles(data);
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
            return input.description;
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

export function bundleHighlightsFilter($sce) {
    return function(input) {
        let highlights = [];

        if (input && input.types) {
            let entities = input.types.filter(type => type.supertypes.includes('org.apache.brooklyn.api.entity.Entity')).length;
            let policies = input.types.filter(type => type.supertypes.includes('org.apache.brooklyn.api.policy.Policy')).length;
            let enrichers = input.types.filter(type => type.supertypes.includes('org.apache.brooklyn.api.sensor.Enricher')).length;

            if (entities > 0) {
                highlights.push({
                    label: (entities==1 ? 'entity' : 'entities'),
                    count: entities
                });
            }
            if (policies > 0) {
                highlights.push({
                    label: (policies==1 ? 'policy' : 'policies'),
                    count: policies
                });
            }
            if (enrichers > 0) {
                highlights.push({
                    label: (enrichers==1 ? 'enricher' : 'enrichers'),
                    count: enrichers
                });
            }
        }

        return $sce.trustAsHtml(highlights.map(highlight => {
            return `<span class="highlight-count">${highlight.count}</span>&nbsp;<span class="highlight-label">${highlight.label}</span>`
        }).join('&nbsp;'));
    };
}

export function bundleTypeFilter() {
    return function(input, superType) {
        return input && input.filter(type => type.supertypes.includes(superType));
    }
}
