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
import {transformResponse} from '../../../components/transformers/locations.transformer';
import locationUtils from '../../../components/location-utils/location-utils';
import template from './cloud.template.html';

const MODULE_NAME = 'state.wizard.cloud';

angular.module(MODULE_NAME, [uiRouter, brooklynApi, locationUtils])
    .config(['$stateProvider', wizardCloudStateConfig]);

export default MODULE_NAME;

export const wizardCloudState = {
    name: 'wizard.cloud',
    url: '/cloud?symbolicName&version',
    params: {
        version: {value: null},
        symbolicName: {value: null}
    },
    controller: ['$element', '$state', 'brSnackbar', 'locationSpec', 'location', 'catalogApi', wizardCloudController],
    controllerAs: 'vm',
    template: template,
    resolve: {
        location: ['catalogApi', 'locationApi', '$q', '$stateParams', (catalogApi, locationApi, $q, $stateParams) => {
            if ($stateParams.symbolicName !== null) {
                return catalogApi.getLocation($stateParams.symbolicName, $stateParams.version, {cache: null, transformResponse: transformResponse});
            }
            return;
        }]
    }
};

export function wizardCloudStateConfig($stateProvider) {
    $stateProvider.state(wizardCloudState);
}

export function wizardCloudController($element, $state, brSnackbar, locationSpec, location, catalogApi) {
    $element.find('input')[0].focus();

    let vm = this;
    mapLocation();
    vm.providers = locationSpec;

    vm.isRegionDisabled = function () {
        let disabled = ['jclouds:openstack-nova'];
        return disabled.indexOf(vm.provider) > -1;
    };

    vm.isEndpointDisabled = function () {
        let disabled = ['jclouds:aws-ec2', 'jclouds:softlayer'];
        return disabled.indexOf(vm.provider) > -1;
    };

    vm.save = function () {
        let config = angular.copy(vm.config);
        if (vm.region) {
            config.region = vm.region;
        }
        if (vm.endpoint) {
            config.endpoint = vm.endpoint;
        }
        config.identity = vm.identity;
        config.credential = vm.credential;

        let payload = {
            'brooklyn.catalog': {
                bundle: `catalog-bom-${vm.id}`,
                version: vm.version,
                items: [
                    {
                        itemType: 'location',
                        item: {
                            id: vm.id,
                            name: vm.name,
                            type: vm.provider !== 'other' ? vm.provider : vm.spec,
                            'brooklyn.config': config
                        }
                    }
                ]
            }
        };
        catalogApi.create(payload).then(data => {
            $state.go('detail', {symbolicName: vm.id, version: vm.version});
        }).catch(error => {
            brSnackbar.create('Could not save location: ' + error.data.message ? error.data.message : error.data);
        });
    };

    function mapLocation() {
        if (location) {
            vm.id = location.symbolicName;
            vm.name = location.name;
            vm.provider = location.spec;
            vm.region = location.config.region;
            vm.endpoint = location.config.endpoint;
            vm.identity = location.config.identity;
            vm.credential = location.config.credential;
            vm.version = location.version;
            delete location.config.credential;
            delete location.config.identity;
            delete location.config.region;
            delete location.config.endpoint;
            vm.config = location.config;
        } else {
            vm.config = {};
            vm.version = '0.0.0.SNAPSHOT';
        }
    }
}
