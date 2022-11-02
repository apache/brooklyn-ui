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
    $scope.activitiesLoaded = false;

    function mergeActivities() {
        // merge activitiesRaw records with workflows records, into vm.activities;
        // only once activitiesRaw is loaded
        if (vm.activitiesRaw) {
            const newActivitiesMap = {};
            vm.activitiesRaw.forEach(activity => {
                newActivitiesMap[activity.id] = activity;
            });

            const workflowActivities = {}
            Object.values(vm.workflows || {})
                .filter(wf => wf.replays && wf.replays.length)
                .forEach(wf => {
                    const last = wf.replays[wf.replays.length-1];
                    let submitted = {};
                    let firstTask, lastTask;

                    wf.replays.forEach(wft => {
                        let t = newActivitiesMap[wft.taskId];
                        if (!t) {
                            // create stub tasks for the replays of workflows
                            t = makeTaskStubFromWorkflowRecord(wf, wft);
                            workflowActivities[wft.taskId] = t;
                            //newActivitiesMap[wft.taskId] = t;
                        }
                        t.workflowId = wf.workflowId;
                        t.workflowParentId = wf.parentId;

                        // overriding submitters breaks things (infinite loop, in kilt?)
                        // so instead just set whether it is the latest replay
                        t.isWorkflowFirstRun = false;
                        t.isWorkflowLastRun = false;
                        t.isWorkflowTopLevel = !wf.parentId;
                        if (!firstTask) firstTask = t;
                        lastTask = t;
                    });
                    firstTask.isWorkflowFirstRun = true;
                    lastTask.isWorkflowLastRun = true;
                });

            // workflow stubs need sorting by us
            let workflowStubsToSort = Object.values(workflowActivities);
            function firstDate(d1, d2, nextSupplier) {
                if (d1==d2) return nextSupplier();
                if (!(d1>0) && !(d2>0)) return nextSupplier();
                if (d1>0 && d2>0) return d2-d1;
                return d1>0 ? 1 : -1;
            }
            workflowStubsToSort.sort( (w1,w2) =>
                firstDate(w1.endTimeUtc, w2.endTimeUtc,
                    () => firstDate(w1.startTimeUtc, w2.startTimeUtc,
                        () => firstDate(w1.submitTimeUtc, w2.submitTimeUtc,
                            () => 0))) );
            workflowStubsToSort.forEach(wst => newActivitiesMap[wst.id] = wst);

            vm.activitiesMap = newActivitiesMap;
            vm.activities = Object.values(newActivitiesMap);
        }
    }

    let activitiesRawLoadAttemptFinished = false;
    let workflowLoadAttemptFinished = false;

    function onStateChange() {
      if ($state.current.name === activitiesState.name && !vm.activities) {
        // only run if we are the active state

        const checkTasksLoadAttemptsFinished = () => {
            $scope.activitiesLoaded = activitiesRawLoadAttemptFinished && workflowLoadAttemptFinished;
        }
        entityApi.entityActivities(applicationId, entityId).then((response) => {
            vm.activitiesRaw = response.data;
            mergeActivities();
            observers.push(response.subscribe((response) => {
                vm.activitiesRaw = response.data;
                mergeActivities();
                vm.error = undefined;
            }));
            activitiesRawLoadAttemptFinished = true;
            checkTasksLoadAttemptsFinished();
        }).catch((error) => {
            $log.warn('Error loading activities for entity '+entityId, error);
            vm.error = 'Cannot load activities for entity with ID: ' + entityId;
            activitiesRawLoadAttemptFinished = true;
            checkTasksLoadAttemptsFinished();
        });

        entityApi.getWorkflows(applicationId, entityId).then((response) => {
            vm.workflows = response.data;
            mergeActivities();
            observers.push(response.subscribe((response) => {
                vm.workflows = response.data;
                mergeActivities();
            }));
            workflowLoadAttemptFinished = true;
            checkTasksLoadAttemptsFinished();
        }).catch((error) => {
            $log.warn('Error loading workflows for entity ' + entityId, error);
            workflowLoadAttemptFinished = true;
            checkTasksLoadAttemptsFinished();
        });

        entityApi.entityActivitiesDeep(applicationId, entityId).then((response) => {
            vm.activitiesDeep = response.data;
            observers.push(response.subscribe((response) => {
                vm.activitiesDeep = response.data;
                vm.error = undefined;
            }));
        }).catch((error) => {
            $log.warn('Error loading activity children deep for entity ' + entityId, error);
            vm.error = 'Cannot load activities (deep) for entity with ID: ' + entityId;
        });

        $scope.$on('$destroy', () => {
          observers.forEach((observer) => {
              observer.unsubscribe();
          });
        });
      }
    }

    // these are passed around so that the task list and the kilt view share info on DST's, at least
    // (would be nice to share more but that gets trickier, and this is the essential!)
    vm.onFilteredActivitiesChange = function (newActivities, globalFilters) {
        vm.focusedActivities = newActivities;
        $scope.globalFilters = globalFilters;
    }
}

export function makeTaskStubFromWorkflowRecord(wf, wft) {
    const result = {
        id: wft.taskId,
        displayName: wf.name + (wft.reasonForReplay && wft.reasonForReplay!="Initial run" ? " ("+wft.reasonForReplay+")" : ""),
        entityId: (wf.entity || {}).id,
        isError: wft.isError===false ? false : true,
        currentStatus: _.isNil(wft.isError) ? "Unavailable" : wft.status,
        submitTimeUtc: wft.submitTimeUtc,
        startTimeUtc: wft.startTimeUtc,
        endTimeUtc: wft.endTimeUtc,
        isTaskStubFromWorkflowRecord: true,
        tags: [
            "WORKFLOW",
            {
                workflowId: wf.workflowId,
                applicationId: wf.applicationId,
                entityId: wf.entityId,
            },
        ],
    };
    if (wft.submittedByTaskId) {
        result.submittedByTask = {
            metadata: {
                id: wft.submittedByTaskId,
                entityId: result.entityId,
            }
        };
    }
    return result;
};
