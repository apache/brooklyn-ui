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
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from "./effectors.template.html";

function EffectorsController($scope, $stateParams, $location, entityApi) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    const {
        applicationId,
        entityId
    } = $stateParams;

    let vm = this;
    vm.error = {};
    vm.applicationId = applicationId;
    vm.entityId = entityId;
    vm.effectorToOpen = $location.search().effector;

    entityApi.entityEffectors(applicationId, entityId).then((response)=> {
        vm.effectors = response.data.map(function (effector) {
            effector.parameters.map(function (parameter) {
                parameter.value = parameter.defaultValue;
                return parameter;
            });
            return effector;
        });
        vm.error = {};
    }).catch((error)=> {
        vm.error.effectors =  'Cannot load effector for entity with ID: ' + entityId;
    });
}

export const effectorsState = {
    name: 'main.inspect.effectors',
    url: '/effectors',
    template: template,
    controller: ['$scope', '$stateParams', '$location', 'entityApi', EffectorsController],
    controllerAs: 'vm'
};
