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
import {makeTaskStubFromWorkflowRecord} from "../activities.controller";

export const detailState = {
    name: 'main.inspect.activities.detail',
    url: '/:activityId?workflowId',
    template: template,
    controller: ['$scope', '$state', '$stateParams', '$log', '$uibModal', '$timeout', '$sanitize', '$sce', 'activityApi', 'entityApi', 'brUtilsGeneral', DetailController],
    controllerAs: 'vm',
}
function DetailController($scope, $state, $stateParams, $log, $uibModal, $timeout, $sanitize, $sce, activityApi, entityApi, Utils) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    const {
        applicationId,
        entityId,
        activityId,
    } = $stateParams;
    $scope.workflowId = $stateParams.workflowId;

    let vm = this;
    vm.model = {
        appId: applicationId,
        entityId: entityId,
        activityId: activityId,
        childFilter: {'EFFECTOR': true, 'SUB-TASK': false},
        accordion: {summaryOpen: true, subTaskOpen: true, streamsOpen: true, workflowOpen: true},
        activity: {},
        workflow: {},
    };

    vm.modalTemplate = modalTemplate;
    vm.wideKilt = false;
    $scope.actions = {};

    let observers = [];

    if ($state.current.name === detailState.name) {

        function loadWorkflow(workflowTag, optimistic) {
            if (!workflowTag) {
                workflowTag = {}
                optimistic = true;
            }
            vm.model.workflow.loading = 'loading';

            $scope.workflowId = workflowTag.workflowId || $scope.workflowId || activityId;
            return entityApi.getWorkflow(workflowTag.applicationId || applicationId, workflowTag.entityId || entityId, $scope.workflowId).then(wResponse => {
                $scope.workflowId = wResponse.data.workflowId;
                workflowTag = {applicationId, entityId, workflowId: $scope.workflowId, ...workflowTag};
                if (optimistic) {
                    vm.model.workflow.tag = workflowTag;
                }
                vm.model.workflow.data = wResponse.data;
                vm.model.workflow.loading = 'loaded';
                vm.model.workflow.applicationId = workflowTag.applicationId;
                vm.model.workflow.entityId = workflowTag.entityId;

                $scope.actions.workflowReplays = [];
                if (!vm.model.activity.endTimeUtc || vm.model.activity.endTimeUtc<=0) {
                    // can't replay if active (same logic as 'cancel')
                } else {
                    $scope.actions.workflowReplays = [];
                    const stepIndex = (vm.model.workflow.tag || {}).stepIndex;

                    let replayableFromStart = vm.model.workflow.data.replayableFromStart, replayableContinuing = vm.model.workflow.data.replayableLastStep>=0;

                    if (replayableContinuing) {
                        $scope.actions.workflowReplays.push({ targetId: 'end', targetName: 'Resume '+(stepIndex>=0 ? 'workflow ' : '')+' (at step '+(vm.model.workflow.data.replayableLastStep+1)+')' });
                    }

                    // get current step, replay from that step
                    if (stepIndex>=0) {
                        const osi = workflow.data.oldStepInfo[stepIndex] || {};
                        if (osi.replayableFromHere) {
                            $scope.actions.workflowReplays.push({ targetId: ''+stepIndex, targetName: 'Replay from here (step '+(stepIndex+1) });
                        } else {
                            $scope.actions.workflowReplays.push({ targetId: ''+stepIndex, targetName: 'Force replay from here (step '+(stepIndex+1), force: true });
                        }
                    }

                    if (replayableFromStart) {
                        let w1 = 'Restart', w2 = '(not resumable)';
                        if (stepIndex<0) { w1 = 'Run'; w2 = 'again'; }
                        else if (_.isNil(stepIndex)) { w2 = '(did not start)'; }
                        else if (replayableContinuing) w2 = '';

                        $scope.actions.workflowReplays.push({targetId: 'start', targetName: 'Restart '+(stepIndex>=0 ? 'workflow ' : '')+reason});
                    }

                    if (!replayableFromStart) {
                        $scope.actions.workflowReplays.push({targetId: 'start', targetName: 'Force restart', force: true});
                    }
                    // force replays
                    $scope.actions.workflowReplays.forEach(r => {
                        // could prompt for a reason
                        const targetId = r.targetId;
                        const opts = {};
                        opts.reason = "UI manual replay";
                        if (r.force) {
                            opts.force = true;
                            opts.reason += " (forced)";
                        }
                        r.action = () => {
                            entityApi.replay(applicationId, entityId, $scope.workflowId. targetId, opts);
                        };
                    });
                }
                if (!$scope.actions.workflowReplays.length) delete $scope.actions['workflowReplays'];

                if (vm.model.workflow.data.status === 'RUNNING') wResponse.interval(1000);
                observers.push(wResponse.subscribe((wResponse2)=> {
                    // change the workflow object so widgets get refreshed
                    vm.model.workflow = { ...vm.model.workflow, data: wResponse2.data };
                }));

            }).catch(error => {
                if (optimistic) {
                    vm.model.workflow.loading = null;
                    throw error;
                }

                console.log("ERROR loading workflow " + $scope.workflowId, error);
                vm.model.workflow.loading = 'error';
            });
        };

        activityApi.activity(activityId).then((response)=> {
            vm.model.activity = response.data;

            delete $scope.actions['effector'];
            delete $scope.actions['invokeAgain'];
            if ((vm.model.activity.tags || []).find(t => t=="EFFECTOR")) {
                const effectorName = (vm.model.activity.tags.find(t => t.effectorName) || {}).effectorName;
                const effectorParams = (vm.model.activity.tags.find(t => t.effectorParams) || {}).effectorParams;
                if (effectorName) {
                    $scope.actions.effector = {effectorName};
                    if (effectorParams) {
                        $scope.actions.invokeAgain = {effectorName, effectorParams, doAction: () => vm.invokeEffector(effectorName, effectorParams) };
                    }
                }
            }

            delete $scope.actions['cancel'];
            if (!vm.model.activity.endTimeUtc || vm.model.activity.endTimeUtc<=0) {
                $scope.actions.cancel = { doAction: () => { activityApi.cancelActivity(activityId); } };
            }

            $scope.workflowId = null;  // if the task loads, force the workflow id to be found on it, otherwise ignore it
            if ((vm.model.activity.tags || []).find(t => t=="WORKFLOW")) {
                const workflowTag = getTaskWorkflowTag(vm.model.activity);
                if (workflowTag) {
                    vm.model.workflow.tag = workflowTag;
                    loadWorkflow(workflowTag);
                }
            }

            vm.error = undefined;
            if (!vm.model.activity.endTimeUtc || vm.model.activity.endTimeUtc<0) response.interval(1000);
            observers.push(response.subscribe((response)=> {
                vm.model.activity = response.data;
                vm.error = undefined;
                vm.errorBasic = false;
            }));

        }).catch((error)=> {
            $log.warn('Error loading activity for '+activityId, error);
            // prefer this simpler error message over the specific ones below
            vm.errorBasic = true;
            vm.error = $sce.trustAsHtml('Cannot load task with ID: <b>' + _.escape(activityId) + '</b> <br/><br/>' +
                'The task is no longer stored in memory. Details may be available in logs.');

            // in case it corresponds to a workflow and not a task, try loading as a workflow
            function onNonTaskWorkflowLoad() {
                const wft = (vm.model.workflow.data.replays || []).find(t => t.taskId === activityId);
                if (wft) {
                    vm.model.activity = makeTaskStubFromWorkflowRecord(vm.model.workflow.data, wft);
                    vm.model.workflow.tag = getTaskWorkflowTag(vm.model.activity);
                } else {
                    throw "Workflow task "+activityId+" not stored on workflow";
                }

                // give a better error
                vm.error = $sce.trustAsHtml('Limited information on workflow task <b>' + _.escape(activityId) + '</b>.<br/><br/>' +
                    (!vm.model.activity.endTimeUtc || vm.model.activity.endTimeUtc==-1
                        ? "The run appears to have been interrupted by a server restart or failover."
                        : 'The workflow is known but this task is no longer stored in memory.') );
            }

            loadWorkflow({workflowId: activityId}).then(onNonTaskWorkflowLoad)
                .catch(error => {
                    loadWorkflow(null).then(onNonTaskWorkflowLoad)
                        .catch(error => {
                            $log.debug("ID "+activityId+"/"+$scope.workflowId+" does not correspond to workflow either", error);
                        });
                });
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
        
        activityApi.activityDescendants(activityId, 8, true).then((response)=> {
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

        // Do not display streams that are not initialized
        for (let name in knownMap) {
            if (knownMap[name] === null || knownMap[name] === undefined) {
                delete knownMap[name];
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

    vm.stringify = (data) => JSON.stringify(data, null, 2);

    vm.invokeEffector = (effectorName, effectorParams) => {
        entityApi.invokeEntityEffector(applicationId, entityId, effectorName, effectorParams).then((response) => {
            $state.go('main.inspect.activities.detail', {
                applicationId: applicationId,
                entityId: entityId,
                activityId: response.data.id,
            });
        });
    }

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

    vm.onFilteredActivitiesChange = function (newActivities, globalFilters) {
        // this uses activity descendants api method which only uses TaskChildren,
        // so transient tasks etc less relevant
    }

    vm.showReplayHelp = () => {
        $scope.showReplayHelp = !$scope.showReplayHelp;
    }

    vm.isNullish = _.isNil;
    vm.isEmpty = x => vm.isNullish(x) || (x.length==0) || (typeof x === 'object' && !Object.keys(x).length);
    vm.isNonEmpty = x => !vm.isEmpty(x);
}

export function getTaskWorkflowTag(task) {
    if (!task) return null;
    if (!task.tags) return null;
    return task.tags.find(t => t.workflowId);
}