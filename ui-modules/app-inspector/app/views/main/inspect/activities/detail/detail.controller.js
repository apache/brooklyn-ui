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
import template from "./detail.template.html";
import modalTemplate from './kilt.modal.template.html';

export const detailState = {
    name: 'main.inspect.activities.detail',
    url: '/:activityId',
    template: template,
    controller: ['$scope', '$state', '$stateParams', '$log', '$uibModal', '$timeout', 'activityApi', 'brUtilsGeneral', DetailController],
    controllerAs: 'vm'
}
function DetailController($scope, $state, $stateParams, $log, $uibModal, $timeout, activityApi, Utils) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    const {
        applicationId,
        entityId,
        activityId
    } = $stateParams;

    let vm = this;
    vm.model = {
        appId: applicationId,
        entityId: entityId,
        activityId: activityId,
        childFilter: {'EFFECTOR': true, 'SUB-TASK': false},
        accordion: {summaryOpen: true, subTaskOpen: true, streamsOpen: true}
    };

    vm.modalTemplate = modalTemplate;
    vm.wideKilt = false;

    let observers = [];

    if ($state.current.name === detailState.name) {
        
        activityApi.activity(activityId).then((response)=> {
            vm.model.activity = response.data;
            vm.error = undefined;
            observers.push(response.subscribe((response)=> {
                vm.model.activity = response.data;
                vm.error = undefined;
                vm.errorBasic = false;
            }));
        }).catch((error)=> {
            $log.warn('Error loading activity for '+activityId, error);
            // prefer this simpler error message over the specific ones below
            vm.errorBasic = true;
            vm.error = 'Cannot load activity with ID: ' + activityId;
        });

        activityApi.activityChildren(activityId).then((response)=> {
            vm.model.activityChildren = processActivityChildren(response.data);
            vm.error = undefined;
            observers.push(response.subscribe((response)=> {
                vm.model.activityChildren = processActivityChildren(response.data);
                if (!vm.errorBasic) {
                    vm.error = undefined;
                }
            }));
        }).catch((error)=> {
            $log.warn('Error loading activity children  for '+activityId, error);
            if (!vm.errorBasic) {
                vm.error = 'Cannot load activity children for activity ID: ' + activityId;
            }
        });
        
        activityApi.activityDescendants(activityId, 8).then((response)=> {
            vm.model.activitiesDeep = response.data;
            vm.error = undefined;
            // TODO would be nice to subscribe more often, e.g. every second
            observers.push(response.subscribe((response)=> {
                vm.model.activitiesDeep = response.data;
                if (!vm.errorBasic) {
                    vm.error = undefined;
                }
            }));
        }).catch((error)=> {
            $log.warn('Error loading activity children deep for '+activityId, error);
            if (!vm.errorBasic) {
                vm.error = 'Cannot load activities children deep for activity ID: ' + activityId;
            }
        });
        
    }

    vm.isNonEmpty = Utils.isNonEmpty;

    vm.getStreamIdsInOrder = function () {
        // sort with known streams first, in preferred order
        // also return just the IDs, setting a map
        var knownMap = {env: null, stdin: null, stdout: null, stderr: null};
        var otherMap = {};
        for (let [name, s] of Object.entries(vm.model.activity.streams)) {
            if (name in knownMap) {
                knownMap[name] = s;
            } else {
                otherMap[name] = s;
            }
        }
        $scope.streamsById = Object.assign({}, knownMap, otherMap);
        return Object.keys($scope.streamsById);
    };

    vm.setWideKilt = function (newValue) {
        vm.wideKilt = newValue;
        // empirically delay of 100ms means it runs after the resize;
        // seems there is no way to hook in to resize events so it is
        // either this or a $scope.$watch with very low interval
        $timeout(function() { $scope.$broadcast('resize') }, 100);
    };
    
    $scope.$on('$destroy', ()=> {
        observers.forEach((observer)=> {
            observer.unsubscribe();
        });
    });

    function processActivityChildren(data) {
        return data.map((child)=> {
            if (child.submittedByTask && child.submittedByTask.metadata.id === activityId && child.tags.indexOf('SUB-TASK') === -1) {
                child.tags.push("BACKGROUND-TASK");
            }
            return child;
        });
    }
}
