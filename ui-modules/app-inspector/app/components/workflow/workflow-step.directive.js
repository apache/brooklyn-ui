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
import template from "./workflow-step.template.html";
import angular from "angular";
import jsyaml from 'js-yaml';

const MODULE_NAME = 'inspector.workflow-step';

angular.module(MODULE_NAME, [])
    .directive('workflowStep', workflowStepDirective);

export default MODULE_NAME;

let count = 0;

export function workflowStepDirective() {
    return {
        template: template,
        restrict: 'E',
        scope: {
            workflow: '=',
            task: '=?',
            step: '<',  // definition
            stepIndex: '<',
            expanded: '=',
            onSizeChange: '=',
        },
        controller: ['$sce', '$scope', 'entityApi', controller],
        controllerAs: 'vm',
    };

    function controller($sce, $scope, entityApi) {
        try {
            let observers = [];
            $scope.$on('$destroy', ()=> {
                observers.forEach((observer)=> {
                    observer.unsubscribe();
                });
            });

            let vm = this;

            let step = $scope.step;
            let index = $scope.stepIndex;
            $scope.workflowId = ($scope.workflow && $scope.workflow.data || {}).workflowId;

            vm.toggleExpandState = () => {
                $scope.expanded = !$scope.expanded;
                if ($scope.onSizeChange) $scope.onSizeChange();
            }
            vm.stringify = stringify;
            vm.yaml = (data) => jsyaml.dump(data);
            vm.yamlOrPrimitive = (data) => typeof data === "string" ? data : vm.yaml(data);
            vm.nonEmpty = (data) => data && (data.length || Object.keys(data).length);
            vm.isNullish = _.isNil;

            vm.getWorkflowNameFromReference = (ref, suffixIfFound) => {
                // would be nice to get a name, but all we have is appId, entityId, workflowId; and no lookup table;
                // could look it up or store at server, but seems like overkill
                if (ref && $scope.task && $scope.task.children) {
                  var matchingChild = $scope.task.children.find(c => c.metadata && c.metadata.id === ref.workflowId);
                  if (matchingChild && matchingChild.metadata.taskName) {
                    return matchingChild.metadata.taskName + (suffixIfFound ? " "+suffixIfFound+" " : "");
                  }
                }
                return null;
            };
            vm.hasInterestingWorkflowNameFromReference = (ref, suffixIfFound) => {
                const wn = vm.getWorkflowNameFromReference(ref, suffixIfFound);
                return wn && wn.toLowerCase()!='sub-workflow';
            };
            vm.classForCodeMaybeMultiline = (obj) => {
                let os = vm.yamlOrPrimitive(obj);
                if (!os) return "simple-code";
                os = ''+os;
                if (os.endsWith('\n')) os = os.substring(0, os.length-1);
                const lines = os.split('\n');
                if (lines.length==1) return "simple-code";
                if (lines.length <= 5) return "multiline-code lines-"+lines.length;
                return "multiline-code multiline-code-resizable lines-"+lines.length;
            };

            $scope.addlData = null;
            $scope.addlMode = null;
            vm.showAdditional = (title, mode, obj) => {
                $scope.addlTitle = title;
                $scope.addlMode = mode;
                $scope.addlData = obj==undefined ? null : vm.yamlOrPrimitive(obj);
            }

            $scope.stepTitle = {
                index: index+1,
            };
            if (typeof step === 'string') {
                $scope.stepTitle.code = step;
            } else {

                let shorthand = step.userSuppliedShorthand || step.step || step.s || step.shorthand;
                $scope.stepTitle.code = shorthand;
                if (!shorthand) {
                    $scope.stepTitle.code = step.shorthandTypeName || step.type || '';
                    if (!$scope.stepTitle.code) {
                        if (step.steps) $scope.stepTitle.leftCodeAlternative = "nested workflow";
                        else $scope.stepTitle.leftCodeAlternative = "workflow step"; // odd...
                    } else {
                        if (step.input) $scope.stepTitle.code += ' ...';
                    }
                }
                if (["workflow","subworkflow"].includes($scope.stepTitle.code)) {
                    $scope.stepTitle.code = null;
                    $scope.stepTitle.leftCodeAlternative = "nested workflow";
                }

                if (step.name) {
                    $scope.stepTitle.name = step.name;
                }
                if (step.id) {
                    $scope.stepTitle.id = step.id;
                }
            }

            function gatherOutputAndScratchForStep(osi, result, visited, isPrevious) {
                if (result.output!=undefined && result.workflowScratch!=undefined) return ;
                if (osi==undefined) {
                    if (result.workflowScratchPartial != undefined) result.workflowScratch = result.workflowScratchPartial;
                    delete result['workflowScratchPartial'];
                    return;
                }
                // osi.woSc
                let output = osi.context && osi.context.output;
                if (isPrevious && output != undefined && result.output == undefined) result.output = output;
                if (isPrevious && osi.workflowScratchUpdates != undefined) result.workflowScratchPartial =
                    Object.assign({}, osi.workflowScratchUpdates, result.workflowScratchPartial);
                if (osi.workflowScratch != undefined) result.workflowScratchPartial =
                    Object.assign({}, osi.workflowScratchUpdates, result.workflowScratchPartial);

                let next = undefined;
                if (osi.previous && osi.previous.length) {
                    const pp = osi.previous[0];
                    if (!visited.includes(pp)) {
                        visited.push(pp);
                        next = $scope.workflow.data.oldStepInfo[pp];
                    }
                }
                gatherOutputAndScratchForStep(next, result, visited, true);
            }

            const resultForStep = {};
            vm.getOutputAndScratchForStep = (i) => {
                if (!resultForStep[i]) {
                    if (!$scope.workflow || !$scope.workflow.data || !$scope.workflow.data.oldStepInfo) return {};
                    const osi = $scope.workflow.data.oldStepInfo[i] || null;
                    if (!osi) return {};
                    resultForStep[i] = {};
                    gatherOutputAndScratchForStep(osi, resultForStep[i], [i], false);
                }
                return resultForStep[i];
            }

            function updateData() {
                let workflow = $scope.workflow;
                workflow.data = workflow.data || {};
                $scope.workflowStepClasses = [];
                if (workflow.data.currentStepIndex === index) $scope.workflowStepClasses.push('current-step');

                $scope.isRunning = (workflow.data.status === 'RUNNING');
                $scope.isCurrentMaybeInactive = (workflow.data.currentStepIndex === index);
                $scope.isCurrentAndActive = ($scope.isCurrentMaybeInactive && $scope.isRunning);
                $scope.isWorkflowError = (workflow.data.status && workflow.data.status.startsWith('ERROR'));
                $scope.osi = workflow.data.oldStepInfo[index] || {};
                $scope.stepContext = ($scope.isCurrentMaybeInactive ? workflow.data.currentStepInstance : $scope.osi.context) || {};
                $scope.isFocusStep = $scope.workflow.tag && ($scope.workflow.tag.stepIndex === index);
                $scope.isFocusTask = false;
                $scope.isErrorHandler = $scope.workflow.tag && ($scope.workflow.tag.errorHandlerForTask);

                if ($scope.task) {
                    if (!vm.isNullish($scope.stepContext.taskId) && $scope.stepContext.taskId === $scope.task.id) {
                        $scope.isFocusTask = true;

                    } else if ($scope.isFocusStep) {
                        // careful -- other instance of this step selected
                    }
                }

                $scope.stepCurrentError =
                    ($scope.stepContext.error && !$scope.isFocusTask)
                    ? 'This step had an error.'
                    : ($scope.isWorkflowError && $scope.isCurrentMaybeInactive)
                    ? 'The workflow encountered an error at this step.'  /* odd */
                    : null;
                const incomplete = $scope.osi.countStarted - $scope.osi.countCompleted > ($scope.isCurrentAndActive ? 1 : 0);

                $scope.stepCurrentWarning = $scope.stepCurrentError ? null :
                    $scope.stepContext.errorHandlerTaskId
                    ? 'This step had an error which was handled.'
                    : incomplete
                    ? 'This step has previously had an error'
                    : null;
                $scope.stepCurrentSuccess = $scope.stepCurrentError || $scope.stepCurrentWarning ? null :
                    (!$scope.isCurrentAndActive && !incomplete && $scope.osi.countCompleted > 0)
                    ? 'This step has completed without errors.' : null;
            }
            $scope.$watch('workflow', updateData);
            updateData();

            $scope.showStepDefinitionInBody = true;
            function loadUniqueSubworkflow(workflowTag) {
                if (!workflowTag) return;

                return entityApi.getWorkflow(workflowTag.applicationId, workflowTag.entityId, workflowTag.workflowId).then(wResponse => {
                    if (wResponse.data.status === 'RUNNING') {
                        wResponse.interval(1000);
                        observers.push(wResponse.subscribe(() => loadUniqueSubworkflow(workflowTag)));
                    }

                    $scope.uniqueSubworkflow = {
                        applicationId: workflowTag.applicationId,
                        entityId: workflowTag.entityId,
                        workflowTag: workflowTag,
                        data: wResponse.data,
                    };

                }).catch(error => {
                    console.log("Unable to load single unique workflow", workflowTag, error);
                    $scope.showStepDefinitionInBody = false;
                    $scope.uniqueSubworkflow = undefined;
                });
            }
            if (!$scope.workflow.runIsOld && $scope.stepContext.subWorkflows && $scope.stepContext.subWorkflows.length==1) {
                $scope.showStepDefinitionInBody = false;
                loadUniqueSubworkflow($scope.stepContext.subWorkflows[0]);
            }

        } catch (error) {
            console.log("error showing workflow step", error);
            // the ng-repeat seems to swallow and mask any error in the above - can't understand why! but log it here in case something breaks.
            throw error;
        }
    }

}

function stringify(data) { return JSON.stringify(data, null, 2); }
