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
import template from "./activities.template.html";
import modalTemplate from './kilt.modal.template.html';

export const activitiesState = {
    name: 'main.inspect.activities',
    url: '/activities?search&filter',
    template: template,
    controller: ['$scope', '$state', '$stateParams', '$log', '$timeout', 'entityApi', 'brUtilsGeneral', ActivitiesController],
    controllerAs: 'vm'
};

function ActivitiesController($scope, $state, $stateParams, $log, $timeout, entityApi, Utils) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    const {
        applicationId,
        entityId
    } = $stateParams;
    $scope.search = $stateParams.search;
    $scope.filter = $stateParams.filter;

    let vm = this;

    let observers = [];

    vm.modalTemplate = modalTemplate;

    vm.isNonEmpty = Utils.isNonEmpty;

    vm.wideKilt = false;
    vm.setWideKilt = function (newValue) {
        vm.wideKilt = newValue;
        // empirically delay of 100ms means it runs after the resize;
        // seems there is no way to hook in to resize events so it is
        // either this or a $scope.$watch with very low interval
        $timeout(function() { $scope.$broadcast('resize') }, 100);
    };

    onStateChange();
    $scope.$on('$stateChangeSuccess', (event, toState, toParams, fromState, fromParams, options)=> {
        // as the below only runs if we are the active state, we need to check
        // if we switch from child state to us and we haven't been initialized
        onStateChange();
    })

    function mergeActivities() {
        // merge activitiesRaw records with workflows records, into vm.activities;
        // only once activitiesRaw is loaded
        if (vm.activitiesRaw) {
            const newActivitiesMap = {};
            vm.activitiesRaw.forEach(activity => {
                newActivitiesMap[activity.id] = activity;
            });

            // TODO
            //(vm.workflows || [])
            Object.values(vm.workflows || {})
                .forEach(wf => {
                (wf.replays || []).forEach(wft => {
                    let newActivity = newActivitiesMap[wft.taskId];
                    if (!newActivity) {
                        // create stub tasks for the replays of workflows
                        newActivity = makeTaskStubFromWorkflowRecord(wf, wft);
                        newActivitiesMap[wft.taskId] = newActivity;
                    }
                    newActivity.workflowId = wft.workflowId;
                    newActivity.isWorkflowOldReplay = wft.workflowId !== wft.taskId;
                });
            });
            newActivitiesMap['extra'] = makeTaskStubMock("Extra workflow", "extra", applicationId, entityId);

            vm.activitiesMap = newActivitiesMap;
            vm.activities = Object.values(vm.activitiesMap);
        }
    }

    function onStateChange() {
      if ($state.current.name === activitiesState.name && !vm.activities) {
        // only run if we are the active state
        entityApi.entityActivities(applicationId, entityId).then((response) => {
            vm.activitiesRaw = response.data;
            mergeActivities();
            observers.push(response.subscribe((response) => {
                vm.activitiesRaw = response.data;
                mergeActivities();
                vm.error = undefined;
            }));
        }).catch((error) => {
            $log.warn('Error loading activities for entity '+entityId, error);
            vm.error = 'Cannot load activities for entity with ID: ' + entityId;
        });
        
        entityApi.entityActivitiesDeep(applicationId, entityId).then((response) => {
            vm.activitiesDeep = response.data;
            observers.push(response.subscribe((response) => {
                vm.activitiesDeep = response.data;
                vm.error = undefined;
            }));
        }).catch((error) => {
            $log.warn('Error loading activity children deep for entity '+entityId, error);
            vm.error = 'Cannot load activities (deep) for entity with ID: ' + entityId;
        });

        entityApi.getWorkflows(applicationId, entityId).then((response) => {
          vm.workflows = response.data;
          mergeActivities();
          observers.push(response.subscribe((response) => {
              vm.workflows = response.data;
              mergeActivities();
          }));
        }).catch((error) => {
          $log.warn('Error loading workflows for entity '+entityId, error);
        });


        $scope.$on('$destroy', () => {
          observers.forEach((observer) => {
              observer.unsubscribe();
          });
        });
      }
    }

    vm.onFilteredActivitiesChange = function (newActivities, globalFilters) {
        vm.focusedActivities = newActivities;
        $scope.globalFilters = globalFilters;
    }
}

export function makeTaskStubFromWorkflowRecord(wf, wft) {
    return {
        id: wft.taskId,
        displayName: wf.name + (wft.reasonForReplay ? " ("+wft.reasonForReplay+")" : ""),
        entityId: (wf.entity || {}).id,
        isError: wft.isError===false ? false : true,
        currentStatus: _.isNil(wft.isError) ? "Unavailable" : wft.status,
        submitTimeUtc: wft.submitTimeUtc,
        startTimeUtc: wft.startTimeUtc,
        endTimeUtc: wft.endTimeUtc,
        tags: [
            "WORKFLOW",
            {
                workflowId: wf.workflowId,
                applicationId: wf.applicationId,
                entityId: wf.entityId,
            },
        ],
    };
};

// for testing only
export function makeTaskStubMock(name, id, applicationId, entityId) {
    return {
        id,
        displayName: name,
        entityId: entityId,
        isError: true,
        currentStatus: "Unavailable",
        submitTimeUtc: Date.now()-5000,
        startTimeUtc: Date.now()-4000,
        endTimeUtc: Date.now()-1000,
        tags: [
            "WORKFLOW",
            {
                workflowId: 'extra',
                applicationId: applicationId,
                entityId: entityId,
            },
        ],
    };
}
