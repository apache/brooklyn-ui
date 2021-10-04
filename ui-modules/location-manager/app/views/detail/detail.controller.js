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
import uiRouter from 'angular-ui-router';
import brooklynApi from 'brooklyn-ui-utils/brooklyn.api/brooklyn.api';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import dynamicConfig from '../../components/dynamic-config/dynamic-config';
import locationUtils from '../../components/location-utils/location-utils';
import {oldToCatalogLocation, transformResponse} from '../../components/transformers/locations.transformer';
import template from './detail.template.html';

const MODULE_NAME = 'state.detail';

angular.module(MODULE_NAME, [uiRouter, brooklynApi, dynamicConfig, locationUtils])
    .config(['$stateProvider', detailStateConfig]);

export default MODULE_NAME;

export const detailState = {
    name: 'detail',
    url: '/location?symbolicName&version',
    params: {
        version: {value: null},
        symbolicName: {value: null}
    },
    controller: ['$scope', '$filter', '$state', '$stateParams', 'brSnackbar', 'catalogApi', 'location', detailController],
    controllerAs: 'vm',
    template: template,
    resolve: {
        location: ['catalogApi', 'locationApi', '$q', '$stateParams', function (catalogApi, locationApi, $q, $stateParams) {
            if ($stateParams.version !== null) {
                // If there is a version, it means we are asking for a catalog location
                return $q.all([
                    catalogApi.getLocation($stateParams.symbolicName, $stateParams.version, {cache: null, transformResponse: transformResponse}),
                    catalogApi.getLocations({
                        fragment: $stateParams.symbolicName,
                        allVersions: 'true'
                    }, {cache: null, transformResponse: transformResponse})
                ]).then(function (result) {
                    // result[0] is the current location we want to display
                    // result[1] are all location with the same symbolicName. This is to get a list of available versions
                    result[0].versions = result[1].filter((location) => {
                        return location.symbolicName === $stateParams.symbolicName && location.version !== $stateParams.version
                    }).map((location) => {
                        return location.version;
                    });
                    return result[0];
                });
            } else {
                // Otherwise, let's hit the old API
                return locationApi.getLocation($stateParams.symbolicName).then(function (location) {
                    return oldToCatalogLocation(location);
                });
            }
        }]
    }
};

export function detailStateConfig($stateProvider) {
    $stateProvider.state(detailState);
}

export function detailController($scope, $filter, $state, $stateParams, brSnackbar, catalogApi, location) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    $scope.state = {};
    $scope.onDeleted = () => {
        $state.go('locations');
        brSnackbar.create('Location "' + $filter('locationName')(vm.location) + '" deleted successfully');
    };

    let vm = this;
    vm.location = angular.copy(location);
    vm.editLocation = function () {
        if (vm.location['spec'].indexOf('byon') >= 0) {
            $state.go('wizard.byon', {symbolicName: $stateParams.symbolicName, version: $stateParams.version});
        }
        else if (vm.location['spec'].indexOf('jclouds') >= 0) {
            $state.go('wizard.cloud', {symbolicName: $stateParams.symbolicName, version: $stateParams.version});
        }
        else {
            $state.go('wizard.advanced', {symbolicName: $stateParams.symbolicName, version: $stateParams.version});
        }
    };
    vm.hasLocationConfig = function () {
        return vm.location && vm.location.config && Object.keys(vm.location.config).length > 0;
    };
}
