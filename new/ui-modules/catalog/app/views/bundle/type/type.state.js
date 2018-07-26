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
import template from './type.template.html';
import modalTemplate from './modal.template.html';
import brooklynTypeItem from '../../../components/type-item/index';
import {catalogState} from '../../catalog/catalog.state';
import brooklynCatalogApi from 'brooklyn-ui-utils/providers/catalog-api.provider';
import {locationApiProvider} from 'brooklyn-ui-utils/providers/location-api.provider';
import brooklynQuickLaunch from 'brooklyn-ui-utils/quick-launch/quick-launch';
import brTable from 'brooklyn-ui-utils/table/index';
import brUtils from 'brooklyn-ui-utils/utils/general';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';

const MODULE_NAME = 'type.state';

angular.module(MODULE_NAME, [brooklynCatalogApi, brooklynQuickLaunch, brooklynTypeItem, brUtils, brTable])
    .provider('locationApi', locationApiProvider)
    .config(['$stateProvider', typeStateConfig]);

export default MODULE_NAME;

export const bundleState = {
    name: 'bundle.type',
    url: '/types/:typeId/:typeVersion',
    template: template,
    controller: ['$scope', '$state', '$stateParams', '$q', '$uibModal', 'brBrandInfo', 'brUtilsGeneral', 'brSnackbar', 'catalogApi', typeController],
    controllerAs: 'ctrl'
};

export function typeStateConfig($stateProvider) {
    $stateProvider.state(bundleState);
}

export function typeController($scope, $state, $stateParams, $q, $uibModal, brBrandInfo, brUtilsGeneral, brSnackbar, catalogApi) {
    $scope.state = {
        default: 2,
        limit: 2
    };
    $scope.toggleSupertypes = () => {
        $scope.state.limit = $scope.state.limit === $scope.state.default ? $scope.type.supertypes.length : $scope.state.default;
    };

    $scope.isEditable = () => {
        return $scope.type && $scope.type.containingBundle.startsWith('catalog-bom');
    };

    $scope.isDeployable = ()=> {
        return $scope.type && $scope.type.supertypes.some(supertype => {
            return ['org.apache.brooklyn.api.entity.Application', 'org.apache.brooklyn.api.entity.Entity'].includes(supertype);
        });
    };

    $scope.isNonEmpty = (o) => {
        return brUtilsGeneral.isNonEmpty(o);
    };

    $scope.deploy = (event)=> {
        let instance = $uibModal.open({
            template: modalTemplate,
            controller: ['$scope', '$location', 'entitySpec', 'locations',  modalController],
            size: 'lg',
            backdrop: 'static',
            windowClass: 'quick-launch-modal',
            resolve: {
                entitySpec: ()=> {
                    return $scope.type;
                },
                locations: ['locationApi', (locationApi)=> {
                    return locationApi.getLocations();
                }]
            },
            scope: $scope
        });

        // If modal resolve fails, it means that we cannot open the deployment modal => inform the user
        instance.opened.catch((reason)=> {
            brSnackbar.create('Cannot load deployment information for ' + item.symbolicName + ':' + item.version);
        });

        // `instance.result` is resolved when the modal is closed, it means that we have successfully deployed our app
        instance.result.then((results)=> {
            brSnackbar.create('Application deployed', {label: 'View', callback: ()=> {
                window.location.href = brBrandInfo.getAppDeployedUrl(results.data.entityId, results.data.entityId);
            }});
        });

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
        catalogApi.getTypeVersions($stateParams.typeId)
    ]).then(responses => {
        $scope.bundle = responses[0];
        $scope.type = responses[1];
        $scope.versions = responses[2].map(typeVersion => {
            return {
                bundleSymbolicName: typeVersion.containingBundle.split(':')[0],
                bundleVersion: typeVersion.containingBundle.split(':')[1],
                typeVersion: typeVersion.version
            };
        });
        
        $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    }).catch(error => {
        brSnackbar.create(`Could not load type ${$stateParams.bundleId}:${$stateParams.bundleVersion}: ${error.status === 404 ? 'Not found' : error.message}`);
        $state.go(catalogState);
    });
    
    $scope.tables = {};
    ['config', 'sensors', 'effectors'].forEach((t) => $scope.tables[t] = { columns: [] });
    
    function addColumn(cols, base) {
        Object.keys(cols).forEach( (k) => { $scope.tables[k].columns.push( Object.assign({}, base, cols[k]) ); } );
    };
    
    addColumn( { 
            config: { header: 'Config Key' },
            sensors: { header: 'Sensor' },
            effectors: { header: 'Effector' }
        }, {
            field: 'name',
            template: '<samp>{{ item.name }}</samp>',
            width: 100,
            colspan: 3,
        } );
    addColumn({ config: { field: 'label', colspan: 3, hidden: true } });
    addColumn( { 
            config: {},
            sensors: {},
            effectors: { field: 'returnType' }
        }, {
            field: 'type',
            template: '<span class="label-color column-for-type oneline label label-success">{{ item[column.field] }}</span>',
            colspan: 3,
        } );
    addColumn( { 
            config: {},
            sensors: {},
            effectors: {}
        }, {
            field: 'description',
            width: 150,
            colspan: 6,
            tdClass: 'column-for-description',
        } );
        
    addColumn({ config: { field: 'defaultValue', colspan: 3,
            template: '<samp>{{ item.defaultValue }}</samp>'  } });
    $scope.hasEntry = (list, v) => list.find( (entry) => entry.toUpperCase() == v.toUpperCase() );
    addColumn({ config: { field: 'priority',
            template: '<div style="display: flex; justify-content: flex-end;">{{ item.priority }}</div>',
            width: 75, hidden: true,
        } });
    addColumn({ config: { field: 'pinned', width: 75, tdClass: 'center',
            template: '<i class="fa fa-check" ng-if="item.pinned"/>'  } });
    addColumn({ config: { field: 'reconfigurable', width: 120, tdClass: 'center', hidden: true,
            template: '<i class="fa fa-check" ng-if="item.reconfigurable"/>'  } });
    addColumn({ config: { field: 'required', width: 85, tdClass: 'center', orderBy: null,
            template: '<i class="fa fa-check" ng-if="hasEntry(item.constraints, \'required\')"/>'  } });
    addColumn({ config: { field: 'constraints', width: 120, colspan: 2, hidden: true,
            template: '<samp>{{ item.constraints }}</samp>'  } });

    addColumn({ effectors: { field: 'parameters', width: 100, colspan: 4,
            templateUrl: 'catalog/type/effector/parameters.html' } });
    
}
