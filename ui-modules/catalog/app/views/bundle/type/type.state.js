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
import ngSanitize from "angular-sanitize";
import template from './type.template.html';
import modalTemplate from './modal.template.html';
import brooklynTypeItem from '../../../components/type-item/index';
import {catalogState} from '../../catalog/catalog.state';
import brooklynCatalogApi from 'brooklyn-ui-utils/providers/catalog-api.provider';
import {locationApiProvider} from 'brooklyn-ui-utils/providers/location-api.provider';
import brooklynQuickLaunch from 'brooklyn-ui-utils/quick-launch/quick-launch';
import brTable from 'brooklyn-ui-utils/table/index';
import brUtils from 'brooklyn-ui-utils/utils/general';
import mdHelper from 'brooklyn-ui-utils/md-helper';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';

const MODULE_NAME = 'type.state';

angular.module(MODULE_NAME, [ngSanitize, brooklynCatalogApi, brooklynQuickLaunch, brooklynTypeItem, brUtils, brTable, mdHelper])
    .provider('locationApi', locationApiProvider)
    .config(['$stateProvider', typeStateConfig]);

export default MODULE_NAME;

export const bundleState = {
    name: 'bundle.type',
    url: '/types/:typeId/:typeVersion',
    template: template,
    controller: ['$scope', '$state', '$stateParams', '$q', '$uibModal', 'brBrandInfo', 'brUtilsGeneral', 'brSnackbar', 'catalogApi', 'mdHelper', 'quickLaunchOverrides',
        typeController],
    controllerAs: 'ctrl'
};

export function typeStateConfig($stateProvider) {
    $stateProvider.state(bundleState);
}

export function typeController($scope, $state, $stateParams, $q, $uibModal, brBrandInfo, brUtilsGeneral, brSnackbar, catalogApi, mdHelper, quickLaunchOverrides) {
    const quickLaunchHelper = {}
    quickLaunchOverrides.configureQuickLaunch(quickLaunchHelper, $scope);

    $scope.state = {
        default: 2,
        limit: 2
    };

    $scope.toggleSupertypes = () => {
        $scope.state.limit = $scope.state.limit === $scope.state.default ? $scope.type.supertypes.length : $scope.state.default;
    };

    $scope.isEditable = () => $scope.type && $scope.type.containingBundle.startsWith('catalog-bom');

    $scope.isDeployable = () => {
        return $scope.type && $scope.type.supertypes.some(supertype =>
            ['org.apache.brooklyn.api.entity.Application', 'org.apache.brooklyn.api.entity.Entity'].includes(supertype)
        );
    };

    $scope.isNonNull = (o) => typeof o !== 'undefined' && o!=null;
    $scope.isNonEmpty = (o) => brUtilsGeneral.isNonEmpty(o);

    $scope.composerUrl = brBrandInfo.blueprintComposerBaseUrl;

    // needed to avoid bug cause by object-based constraints
    $scope.hasEntry = (list, v) => list.find((entry) => (typeof entry === 'string') &&  entry.toUpperCase() === v.toUpperCase());

    $scope.deploy = (event) => {
        const instance = $uibModal.open({
            template: modalTemplate,
            controller: ['$scope', '$location', 'entitySpec', 'locations', 'quickLaunchOverrides', modalController],
            size: 'lg',
            backdrop: 'static',
            windowClass: 'quick-launch-modal',
            resolve: {
                entitySpec: ()=> $scope.type,
                locations: ['locationApi', (locationApi) => locationApi.getLocations()],
            },
            scope: $scope
        });

        // If modal resolve fails, it means that we cannot open the deployment modal => inform the user
        instance.opened.catch((reason)=> {
            brSnackbar.create('Cannot load deployment information for ' + item.symbolicName + ':' + item.version);
        });

        // `instance.result` is resolved when the modal is closed, it means that we have successfully deployed our app
        instance.result
            .then(({ data }) => {
                brSnackbar.create('Application deployed', {
                    label: 'View',
                    callback: () => {
                        window.location.href = brBrandInfo.getAppDeployedUrl(data.entityId, data.entityId);
                    },
                });
            })
            .catch(event => { /* prevents console errors on close */ });

        function modalController($scope, $location, entitySpec, locations) {
            $scope.app = entitySpec;
            $scope.locations = locations;
            $scope.args = $location.search();
        }

        event.preventDefault();
        event.stopPropagation();
    };

    $q.all([
        catalogApi.getBundle($stateParams.bundleId, $stateParams.bundleVersion),
        catalogApi.getBundleType($stateParams.bundleId, $stateParams.bundleVersion, $stateParams.typeId, $stateParams.typeVersion),
        catalogApi.getTypeVersions($stateParams.typeId),
    ])
    .then(async responses => {
        $scope.bundle = responses[0];
        $scope.type = responses[1];

        const entitySpec = $scope.type;
        // update entity spec to keep the right format (repeated in home deploy.controller.js)
        const specItem = entitySpec.specList[0];
        // if the implementation plan does not declare its format but the first spec list item does
        // then we should replace the low-level implementation plan (probably auto-generated) with 
        // the first spec list item (which is what the user created)
        var preferredContents = entitySpec.plan && entitySpec.plan.data;
        const { parsedPlan } = await quickLaunchHelper.getAsCampPlan(entitySpec.plan);
        $scope.templateConfigValues =
            (parsedPlan && parsedPlan['brooklyn.config']) ||
            (parsedPlan && parsedPlan.services && parsedPlan.services.length==1 && parsedPlan.services[0]['brooklyn.config']) ||
            {};

        var preferredFormat = entitySpec.plan && entitySpec.plan.format;
        if (!preferredFormat) {
          if (specItem && specItem.format && specItem.contents) {
            preferredFormat = specItem.format;
            // also take those contents
            preferredContents = specItem.contents;
            entitySpec.plan = { data: preferredContents, format: preferredFormat };
          }
        }

        // save this as the initially selected item in the dropdown of the definition
        this.specItem = specItem;

        // this is used to link to the right editor in composer, preserve the format used to define the item being quick-launched
        $scope.typeFormat = preferredFormat ? 'format=' + preferredFormat + '&' : '';

        $scope.versions = responses[2].map(typeVersion => ({
            bundleSymbolicName: typeVersion.containingBundle.split(':')[0],
            bundleVersion: typeVersion.containingBundle.split(':')[1],
            typeVersion: typeVersion.version,
        }));
        $scope.typeDescription = mdHelper.analyze( ($scope.type || {}).description );
        $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    })
    .catch(error => {
        brSnackbar.create(`Could not load type ${$stateParams.bundleId}:${$stateParams.bundleVersion}: ${error.status === 404 ? 'Not found' : error.message}`);
        $state.go(catalogState);
    });
    $scope.tables = { config: [], sensors: [], effectors: []};

    $scope.markdown = mdHelper.analyze;
    function addColumn(tables, base={}) {
        Object.entries(tables).forEach(([tableKey, props]) => {
            $scope.tables[tableKey].push({ ...base, ...props });
        });

    };

    addColumn( {
        config: { header: 'Config Key' },
        sensors: { header: 'Sensor' },
        effectors: { header: 'Effector' },
    }, {
        field: 'name',
        template: '<div class="mozilla-td-scroll-fix"><samp>{{ item.name }}</samp></div>',
        width: 100,
        colspan: 3,
    });
    addColumn({
        config: {
            field: 'label',
            colspan: 3,
            hidden: true,
        },
    });
    addColumn( {
        config: {},
        sensors: {},
        effectors: { field: 'returnType' },
    }, {
        field: 'type',
        template: '<div class="mozilla-td-scroll-fix"><span class="label-color column-for-type oneline label label-success">{{ item[column.field] }}</span></div>',
        colspan: 3,
    } );

    addColumn( {
        config: {},
        sensors: {},
        effectors: {},
    }, {
        field: 'description',
        width: 150,
        colspan: 6,
        template: '<div class="mozilla-td-scroll-fix"><md-field raw-data="item[column.field]"></md-field></div>',
        tdClass: 'column-for-description',
    });

    addColumn({
        config: {
            field: 'defaultValue',
            colspan: 5,
            template: '<div class="mozilla-td-scroll-fix">' +
                '<p ng-if="isNonNull(templateConfigValues[item.name])"><samp>{{ templateConfigValues[item.name] }}</samp>' +
                    '<span class="label-color oneline label label-info" style="margin-left: 1em;">template</span></p>' +
                '<p ng-if="isNonNull(item.defaultValue)"><samp>{{ item.defaultValue }}</samp></span>' +
                    '<span ng-if="isNonNull(templateConfigValues[item.name])" class="label-color oneline label label-supertype" style="margin-left: 1em;">parameter</span></div>',
        },
    });

    addColumn({
        config: {
            field: 'priority',
            template: '<div style="display: flex; justify-content: flex-end;">{{ item.priority }}</div>',
            width: 75,
            hidden: true,
        },
    });
    addColumn({
        config: {
            field: 'pinned',
            width: 75,
            tdClass: 'center',
            template: '<i class="fa fa-check" ng-if="item.pinned"/>',
        }
    });
    addColumn({
        config:
            {
                field: 'reconfigurable',
                width: 120,
                tdClass: 'center',
                hidden: true,
                template: '<i class="fa fa-check" ng-if="item.reconfigurable"/>',
            }
    });
    addColumn({
        config:
            {
                field: 'required',
                width: 85,
                tdClass: 'center',
                orderBy: null,
                template: '<i class="fa fa-check" ng-if="hasEntry(item.constraints, \'required\')"/>',
            }
    });
    addColumn({
        config: {
            field: 'constraints',
            width: 120,
            colspan: 2,
            hidden: true,
            template: '<div class="mozilla-td-scroll-fix"><samp>{{ item.constraints }}</samp></div>',
        }
    });
    addColumn({
        effectors: {
            field: 'parameters',
            width: 100,
            colspan: 4,
            templateUrl: 'catalog/type/effector/parameters.html',
        }
    });
    
}
