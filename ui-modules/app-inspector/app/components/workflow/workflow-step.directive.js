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
        controller: ['$sce', '$scope', controller],
        controllerAs: 'vm',
    };

    function controller($sce, $scope) {
        try {
            let vm = this;

            let step = $scope.step;
            let index = $scope.stepIndex;

            vm.stepDetails = () => stepDetails($sce, $scope.workflow, step, index, $scope.expanded);
            vm.toggleExpandState = () => {
                $scope.expanded = !$scope.expanded;
                if ($scope.onSizeChange) $scope.onSizeChange();
            }
            vm.stringify = stringify;
            vm.yaml = (data) => jsyaml.dump(data);
            vm.yamlOrPrimitive = (data) => typeof data === "string" ? data : vm.yaml(data);
            vm.nonEmpty = (data) => data && (data.length || Object.keys(data).length);
            vm.isNullish = _.isNil;

            $scope.json = null;
            $scope.jsonMode = null;
            vm.showJson = (mode, json) => {
                $scope.jsonMode = mode;
                $scope.json = json ? stringify(json) : null;
            }

            if (typeof step === 'string') {
                $scope.stepPrefixClass = 'step-index';
                $scope.stepPrefix = index + 1;
                $scope.stepTitleDetail = step;
            } else {

                let shorthand = step.userSuppliedShorthand || step.s || step.shorthand;
                $scope.stepTitleDetail = shorthand;
                if (step.name) {
                    $scope.stepPrefixClass = 'step-name';
                    $scope.stepPrefix = step.name;
                } else {
                    if (step.id) {
                        $scope.stepPrefixClass = 'step-id';
                        $scope.stepPrefix = step.id;
                    } else {
                        $scope.stepPrefixClass = 'step-index';
                        $scope.stepPrefix = index + 1;

                        if (!shorthand) {
                            $scope.stepTitleDetail = step.type || '';
                            if (step.input) $scope.stepTitleDetail += ' ...';
                        }
                    }
                }
            }

            function updateData() {
                let workflow = $scope.workflow;
                workflow.data = workflow.data || {};
                $scope.workflowStepClasses = [];
                if (workflow.data.currentStepIndex === index) $scope.workflowStepClasses.push('current-step');

                $scope.isCurrent = (workflow.data.currentStepIndex === index);
                $scope.isRunning = (workflow.data.status === 'RUNNING');
                $scope.isWorkflowError = (workflow.data.status && workflow.data.status.startsWith('ERROR'));
                $scope.osi = workflow.data.oldStepInfo[index] || {};
                $scope.stepContext = ($scope.isCurrent ? workflow.data.currentStepInstance : $scope.osi.context) || {};

                $scope.isFocusStep = $scope.workflow.tag && ($scope.workflow.tag.stepIndex === index);
                $scope.isFocusTask = false;

                if ($scope.task) {
                    if ($scope.stepContext.taskId === $scope.task.id) {
                        $scope.isFocusTask = true;

                    } else if ($scope.isFocusStep) {
                        // TODO other instance of this tag selected
                    }
                }
            }
            $scope.$watch('workflow', updateData);
            updateData();

        } catch (error) {
            console.log("error showing workflow step", error);
            // the ng-repeat seems to swallow and mask any error in the above - can't understand why! but log it here in case something breaks.
            throw error;
        }
    }

}

function stepDetails($sce, workflow, step, index, expanded) {
    let v;
    if (typeof step === 'string') {
        v = '<span class="step-index">'+_.escape(index+1)+'</span> ';
        v += ' <span class="step-body">' + _.escape(step) + '</span>';
    } else {
        let shorthand = step.userSuppliedShorthand || step.s || step.shorthand;
        if (step.name) {
            v = '<span class="step-name">' + _.escape(step.name) + '</span>';
            if (shorthand) {
                v += ' <span class="step-body">' + _.escape(shorthand) + '</span>';
            }
        } else {
            if (step.id) {
                v = '<span class="step-id">' + _.escape(step.id) + '</span>';
                if (shorthand) {
                    v += ' <span class="step-body">' + _.escape(shorthand) + '</span>';
                }
            } else {
                v = '<span class="step-index">'+_.escape(index+1)+'</span> ';
                if (shorthand) {
                    v += '<span class="step-body">' + _.escape(shorthand);
                } else {
                    v += _.escape(step.type);
                    if (step.input) v += ' ...';
                }
                v += '</span>';
            }
        }
    }
    v = '<div class="step-block-title">'+v+'</div>';

    if (expanded) {
        v += '<br/>';
        const oldStepInfo = (workflow.data.oldStepInfo || {})[index]
        if (oldStepInfo) {
            v += '<pre>' + _.escape(stringify(oldStepInfo)) + '</pre>';
        } else {
            v += _.escape("Step has not been run yet.");
        }
    }
    return $sce.trustAsHtml(v);
}

function stringify(data) { return JSON.stringify(data, null, 2); }
