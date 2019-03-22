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
import template from './advanced.template.html';

const MODULE_NAME = 'state.wizard.advanced';

angular.module(MODULE_NAME, [uiRouter, brooklynApi])
    .config(['$stateProvider', wizardAdvancedStateConfig]);

export default MODULE_NAME;

export const wizardAdvancedState = {
    name: 'wizard.advanced',
    url: '/advanced?symbolicName&version',
    params: {
        version: {value: null},
        symbolicName: {value: null}
    }, controller: ['$element', '$state', 'brSnackbar', 'location', 'catalogApi', wizardAdvancedController],
    controllerAs: 'vm',
    template: template,
    resolve: {
        location: ['catalogApi', '$q', '$stateParams', (catalogApi, $q, $stateParams) => {
            if ($stateParams.symbolicName !== null) {
                return catalogApi.getLocation($stateParams.symbolicName, $stateParams.version, {cache: null, transformResponse: transformResponse});
            }
            return;
        }]
    }
};

export function wizardAdvancedStateConfig($stateProvider) {
    $stateProvider.state(wizardAdvancedState);
}

export function wizardAdvancedController($element, $state, brSnackbar, location, catalogApi) {
    $element.find('input')[0].focus();

    let vm = this;
    mapLocation();
    vm.save = () => {
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
                            type: vm.parent,
                            'brooklyn.config': angular.copy(vm.config)
                        }
                    }
                ]
            }
        };
        catalogApi.create(payload).then(data => {
            $state.go('detail', {symbolicName: vm.id, version: vm.version});
        }).catch(error => {
            brSnackbar.create('Could not save location: ' + error.error.message ? error.error.message : error.data);
        });
    };

    function mapLocation() {
        if (location) {
            vm.id = location.symbolicName;
            vm.name = location.name;
            vm.version = location.version;
            vm.parent = location.spec;
            vm.config = location.config;
        } else {
            vm.config = {};
            vm.version = '0.0.0.SNAPSHOT';
        }
    }
}

