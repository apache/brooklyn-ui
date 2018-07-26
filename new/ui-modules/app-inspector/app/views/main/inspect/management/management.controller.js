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
import angular from "angular";
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from "./management.template.html";

export const managementState = {
    name: 'main.inspect.management',
    url: '/management',
    template: template,
    controller: ['$scope', '$state', '$stateParams', 'entityApi', 'catalogApi', managementController],
    controllerAs: 'vm'
};

function managementController($scope, $state, $stateParams, entityApi, catalogApi) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    const {
        applicationId,
        entityId
    } = $stateParams;

    let vm = this;
    vm.error = {};
    vm.applicationId = applicationId;
    vm.entityId = entityId;
    vm.masterPolicy = {
        type : '',
        show : false,
        configKeys : [
            {
                'key': '',
                'value': ''
            }
        ]
    };
    vm.newPolicy = angular.copy(vm.masterPolicy);

    let observers = [];

    entityApi.entity(applicationId, entityId).then((response)=> {
        vm.entity = response.data;
    });

    entityApi.entityAdjuncts(applicationId, entityId).then((response)=> {
        vm.adjuncts = response.data;
        vm.error.adjuncts = undefined;
        observers.push(response.subscribe((response)=> {
            vm.adjuncts = response.data;
            vm.error.adjuncts = undefined;
        }));
    }).catch((error)=> {
        vm.error.adjuncts = 'Cannot load adjuncts for entity with ID: ' + entityId;
    });

    vm.addConfigKeyRow = function () {
        vm.newPolicy.configKeys.push({
            key: '',
            value: ''
        });
    };
    vm.removeConfigKeyRow = function (index) {
        vm.newPolicy.configKeys.splice(index, 1);
    };
    vm.onPolicySelect = function ($item) {
        vm.newPolicy.configKeyOptions = $item.config;
    };
    vm.onPolicyConfigSelect = function (configKey, $item) {
        configKey.value = $item.defaultValue;
    };
    vm.getPoliciesFromCatalog = function (term) {
        return catalogApi.getTypes({params: {supertype: 'org.apache.brooklyn.api.policy.Policy', fragment: term}}).then(function (response) {
            return response;
        }).catch(function () {
            return [];
        });
    };

    // TODO support new items besides just policies
    vm.addNewPolicy = function () {
        var mappedConfigKeys = {};
        angular.forEach(vm.newPolicy.configKeys, function(configKey) {
            mappedConfigKeys[configKey.key] = configKey.value;
        });

        entityApi.addEntityPolicy(applicationId, entityId, vm.newPolicy.type, mappedConfigKeys).then((response)=> {
            vm.newPolicy = angular.copy(vm.masterPolicy);
            vm.error.add = undefined;
            $state.go($state.current, {}, {reload: true});
        }).catch((error)=> {
            vm.error.add = error.data.message || "Unexpected error";
        });
    };
    vm.cancelNewPolicy = function () {
        vm.newPolicy = angular.copy(vm.masterPolicy);
    };

    $scope.$on('$destroy', ()=> {
        observers.forEach((observer)=> {
            observer.unsubscribe();
        });
    });
}
