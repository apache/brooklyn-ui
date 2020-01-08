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
import uibModal from 'angular-ui-bootstrap/src/modal/index-nocss';
import uiRouter from 'angular-ui-router';
import brooklynApi from 'brooklyn-ui-utils/brooklyn.api/brooklyn.api';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import modalTemplate from './modal.template.html';
import {filterCatalogQuickLaunch} from '../main.controller.js';

const MODULE_NAME = 'states.main.deploy';

angular.module(MODULE_NAME, [uibModal, uiRouter, brooklynApi])
    .config(['$stateProvider', deployStateConfig]);

export default MODULE_NAME;

export const deployState = {
    name: 'main.deploy',
    url: 'deploy/:bundleSymbolicName/:bundleVersion/:typeSymbolicName/:typeVersion',
    controller: ['$scope', '$state', '$stateParams', '$uibModal', 'brBrandInfo', 'brSnackbar', deployStateController],
    controllerAs: 'vm'
};

export function deployStateConfig($stateProvider) {
    $stateProvider.state(deployState);
}

export function deployStateController($scope, $state, $stateParams, $uibModal, brBrandInfo, brSnackbar) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    let instance = $uibModal.open({
        template: modalTemplate,
        controller: ['$scope', '$location', 'entitySpec', 'locations', modalController],
        size: 'lg',
        backdrop: 'static',
        windowClass: 'quick-launch-modal',
        resolve: {
            entitySpec: ['catalogApi', (catalogApi) => {
                return catalogApi.getBundleType($stateParams.bundleSymbolicName, $stateParams.bundleVersion, $stateParams.typeSymbolicName, $stateParams.typeVersion);
            }],
            locations: ['locationApi', locationApi => locationApi.getLocations()],
        }
    });

    // If modal resolve fails, it means that we cannot open the deployment modal => inform the user and go back to the main page
    instance.opened.catch((reason) => {
        brSnackbar.create('Cannot load deployment information for ' + $stateParams.symbolicName + ':' + $stateParams.version);
        $state.go('main');
    });

    // `instance.result` is resolved when the modal is closed, it means that we having successfully deploy our app
    // It is rejected when we dismissed the modal, we then redirect to the main page
    instance.result.then((results) => {
        brSnackbar.create('Application deployed', {
            label: 'View', callback: () => {
                window.location.href = brBrandInfo.getAppDeployedUrl(results.data.entityId, results.data.entityId);
            }
        });
    }).finally(() => {
        $state.go('main');
    });

    function modalController($scope, $location, entitySpec, locations) {
        $scope.app = entitySpec;
        $scope.locations = filterCatalogQuickLaunch(locations, (t) => {
                $scope.usingCatalogQuickLaunchTags = t.length > 0;
            });
        
        // also supports { noEditButton: true, noComposerButton: true }
        // see quick-launch.js for more info
        $scope.args = angular.extend({
                noCreateLocationLink: $scope.usingCatalogQuickLaunchTags
            },
            $location.search());
        
    }
}

