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
    $scope.filterResult = [];
    $scope.filterValue = $stateParams.search || '';

    const {
        applicationId,
        entityId
    } = $stateParams;

    let vm = this;
    vm.error = {};
    vm.applicationId = applicationId;
    vm.entityId = entityId;
    vm.effectorToOpen = $location.search().effector;
    vm.effectorTasks = {};

    function updateFilters() {
        if (vm.effectors) {
            $scope.filterResult = vm.effectors.filter(effector => effector.name.includes($scope.filterValue)).map(effector => effector.name)
        }
    }

    entityApi.entityEffectors(applicationId, entityId).then((response)=> {
        vm.effectors = response.data.map(function (effector) {
            effector.parameters.map(function (parameter) {
                parameter.value = parameter.defaultValue;
                return parameter;
            });
            return effector;
        });
        vm.error = {};
        updateFilters();
    }).catch((error)=> {
        vm.error.effectors =  'Cannot load effector for entity with ID: ' + entityId;
    });
    entityApi.entityActivities(applicationId, entityId).then((response) => {
        const newTasks = {};
        response.data.forEach(task => {
            if ((task.tags || []).find(t => t == "EFFECTOR")) {
                const name = (task.tags.find(t => t && t.effectorName) || {}).effectorName;
                if (name) {
                    const counts = newTasks[name] = newTasks[name] || { active: 0, failed: 0, cancelled: 0, succeeded: 0 };
                    if (!task.endTimeUtc) counts.active++;
                    else if (task.isCancelled) counts.cancelled++;
                    else if (task.isError) counts.failed++;
                    else counts.succeeded++;
                }
            }
        });
        vm.effectorTasks = newTasks;
    });

    $scope.$watch('filterValue', () => {
        updateFilters();
    });
}

export const effectorsState = {
    name: 'main.inspect.effectors',
    url: '/effectors?search',
    template: template,
    controller: ['$scope', '$stateParams', '$location', 'entityApi', EffectorsController],
    controllerAs: 'vm'
};
