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
import { fromNow } from "brooklyn-ui-utils/utils/momentp";
import { get } from 'lodash';
import uiRouter from 'angular-ui-router';
import uibModal from 'angular-ui-bootstrap/src/modal/index-nocss';
import serverApi from 'brooklyn-ui-utils/api/brooklyn/server.js';
import brInterstitialSpinner from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from "./about.template.html";
import nodeManagementTemplate from "./node-management/node-management.template.html";


const MODULE_NAME = 'states.about';
const BROOKLYN_VERSION = __BROOKLYN_VERSION__;
const BUILD_NAME = __BUILD_NAME__;   // if something embedding brooklyn
const BUILD_VERSION = __BUILD_VERSION__;   // if something embedding brooklyn 
const BUILD_BRANCH = __BUILD_BRANCH__;
const BUILD_COMMIT_ID = __BUILD_COMMIT_ID__;

angular.module(MODULE_NAME, [uiRouter, serverApi, uibModal, brInterstitialSpinner])
    .config(['$stateProvider', aboutStateConfig])
    .filter('timeAgoFilter', timeAgoFilter);

export default MODULE_NAME;

export const aboutState = {
    name: 'about',
    url: '/about',
    template: template,
    controller: ['$scope', '$rootScope', '$element', '$q', '$uibModal', 'brBrandInfo', 'version', 'states', 'serverApi', aboutStateController],
    controllerAs: 'vm',
    resolve: {
        version: ['serverApi', (serverApi) => {
            return serverApi.getVersion();
        }],
        states: ['serverApi', (serverApi) => {
            return serverApi.getHaStates();
        }]
    }
};

export function aboutStateConfig($stateProvider) {
    $stateProvider.state(aboutState);
}

export function aboutStateController($scope, $rootScope, $element, $q, $uibModal, brBrandInfo, version, states, serverApi) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    $scope.getBrandedText = brBrandInfo.getBrandedText;
    $scope.brooklynServerVersion = version.data;
    $scope.haManageErrors = [];
    $scope.states = states.data;
    $scope.buildInfo = {
        buildVersion: BUILD_VERSION,
        buildName: BUILD_NAME,
        buildBranch: BUILD_BRANCH,
        buildCommitId: BUILD_COMMIT_ID,
        brooklynUiBuildVersion: BROOKLYN_VERSION,
    };

    $scope.container = $element[0];
    $scope.now = Date.now();
    $scope.expectedNodeCounter = Object.keys($scope.states.nodes).length;
    $scope.template = 'haStatusTemplate';

    $scope.operations = {
        REMOVE_TERMINATED_NODE: 'Remove',
        REMOVE_ALL_TERMINATED_NODES: 'Remove terminated nodes'
    };

    $scope.importPersistence = function () {
        $rootScope.$broadcast('open-persistence-importer');
    }

    let modalInstance = null;

    $scope.openDialog = function (states, container) {
        $scope.haManageErrors = [];

        if (!modalInstance) {
            modalInstance = $uibModal.open({
                template: nodeManagementTemplate,
                controller: ['$scope', '$uibModalInstance', 'node', nodeManagementModalController],
                controllerAs: 'vm',
                backdrop: 'static',
                windowClass: 'quick-launch-modal',
                size: 'md',
                resolve: {
                    node: function () {
                        return states.nodes[states.ownId];
                    }
                }
            });
            modalInstance.result
                // dealing with the list of requested changes after the modal is closed
                .then((changes) => {
                    $scope.template = 'spinnerTemplate';
                    const promises = changes.map(({ operation }) => operation);

                    Promise.allSettled(promises).then((results) => {
                        results.forEach(({ status, reason }, index) => {
                            if (status === 'rejected') {
                                $scope.haManageErrors.push({
                                    configName: changes[index].configName,
                                    message: get(reason, 'data.message', 'Unknown error.'),
                                });
                            }
                        })
                        container.dispatchEvent(new CustomEvent('update-states', {}));
                    });
                    modalInstance = null;
                })
                .catch(() => {
                    $scope.template = 'spinnerTemplate';
                    container.dispatchEvent(new CustomEvent('update-states', {}));
                    modalInstance = null;
                });
        }

    };

    function nodeManagementModalController($scope, $uibModalInstance, node) {

        // newStatus and newPriority are required to belong to the instance of the modal
        let vm = this;
        vm.newPriority = node.priority;
        vm.newStatus = node.status;
        
        $scope.node = node;
        $scope.statuses = ["MASTER", "STANDBY", "HOT_STANDBY", "HOT_BACKUP"];
        $scope.now = Date.now();
        $scope.showEditOptions = false;

        $scope.applyChangesAndQuit = function () {
            const changes = [];

            if ($scope.node.priority !== vm.newPriority) {
                const result = serverApi.setHaPriority(vm.newPriority);
                changes.push({ configName: 'Priority', operation: result });
            }
            if ($scope.node.status !== vm.newStatus) {
                const result = serverApi.setHaStatus(vm.newStatus);
                changes.push({ configName: 'Status', operation: result });
            }

            $uibModalInstance.close(changes);
        }

        $scope.cancelAndQuit = function () {
            vm.newPriority = $scope.node.priority;
            vm.newStatus = $scope.node.status;
            $uibModalInstance.dismiss();
        }

        $scope.doShowEditOptions = function () {
            $scope.showEditOptions = true;
        }
    }

    function NodeManagementErrorModalController($scope, $uibModalInstance, errors) {
        $scope.errors = errors;

        $scope.okClicked = function() {
            $uibModalInstance.close();
        }
    }

    $scope.$watchCollection('haManageErrors', (errors) => {
        if (errors.length) {
            const errorModal = $uibModal.open({
                templateUrl: 'haManageErrorsModal.html',
                controller: ['$scope', '$uibModalInstance', 'errors', NodeManagementErrorModalController],
                backdrop: 'static',
                size: 'md',
                resolve: {
                    errors: function () {
                        return $scope.haManageErrors;
                    },
                },
            });

            errorModal.closed.then(() => {
                $scope.errors = [];
                $scope.haManageErrors = [];
            })
        }
    });

    $scope.removeNode = function (nodeId) {
        $scope.template = 'spinnerTemplate';
        let removeNode = serverApi.removeHaTerminatedNode(nodeId);
        removeNode.then(() => {
            $scope.expectedNodeCounter--;
        }).catch(error => {
            $scope.haManageErrors.push({
                operationName: $scope.operations.REMOVE_TERMINATED_NODE,
                message: get(error, 'data.message', 'Unknown error.'),
            });
        });
        $scope.container.dispatchEvent(new CustomEvent('update-states', {}));
    }

    $scope.removeAllTerminatedNodes = function () {
        $scope.template = 'spinnerTemplate';
        let removeNodes = serverApi.removeHaTerminatedNodes();
        removeNodes.then(() => {
            Object.values($scope.states.nodes).forEach( ({ status }) => {
                if (status === "TERMINATED" || status === "FAILED") $scope.expectedNodeCounter--;
            });
        }).catch(error => {
            $scope.haManageErrors.push({
                operationName: $scope.operations.REMOVE_ALL_TERMINATED_NODES,
                message: get(error, 'data.message', 'Unknown error.'),
            });
        });
        $scope.container.dispatchEvent(new CustomEvent('update-states', {}));
    };

    $element.bind('update-states', () => {
        let updateStates = serverApi.getHaStates();
        updateStates.then(({ data }) => {
            if (Object.keys(data.nodes).length === $scope.expectedNodeCounter) {
                $scope.states = data;
                $scope.now = Date.now();
                $scope.template = 'haStatusTemplate';
            } else {
                $scope.container.dispatchEvent(new CustomEvent('update-states', {}));
            }
        })
    })

}

export function timeAgoFilter() {
    return function (input) {
        if (input) {
            return fromNow(input);
        }
    }
}
