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
import moment from "moment";
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
    controller: ['$scope', '$element', '$q', '$uibModal', 'brBrandInfo', 'version', 'states', 'serverApi', aboutStateController],
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

export function aboutStateController($scope, $element, $q, $uibModal, brBrandInfo, version, states, serverApi) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    $scope.getBrandedText = brBrandInfo.getBrandedText;
    $scope.serverVersion = version.data;
    $scope.states = states.data;
    $scope.buildInfo = {
        buildVersion: BUILD_VERSION,
        buildName: BUILD_NAME,
        buildBranch: BUILD_BRANCH,
        buildCommitId: BUILD_COMMIT_ID,
        brooklynVersion: BROOKLYN_VERSION,
    };

    $scope.container = $element[0];
    $scope.now = Date.now();
    $scope.expectedNodeCounter = Object.keys($scope.states.nodes).length;
    $scope.template = 'haStatusTemplate';

    let modalInstance = null;

    $scope.openDialog = function (states, container) {
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
            modalInstance.result.then(
                (promiseList) => {
                    $scope.template = 'spinnerTemplate';
                    Promise.allSettled(promiseList).then((values) => {
                        container.dispatchEvent(new CustomEvent('update-states', {}));
                    });
                    modalInstance = null;
                },
                () => {
                    $scope.template = 'spinnerTemplate';
                    container.dispatchEvent(new CustomEvent('update-states', {}));
                    modalInstance = null;
                }
            );
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
            let promiseList = [];
            if ($scope.node.priority !== vm.newPriority) {
                let result = serverApi.setHaPriority(vm.newPriority);
                promiseList.push(result);
            }
            if ($scope.node.status !== vm.newStatus) {
                let result = serverApi.setHaStatus(vm.newStatus);
                promiseList.push(result);
            }
            $uibModalInstance.close(promiseList);

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

    $scope.removeNode = function (nodeId) {
        $scope.template = 'spinnerTemplate';
        let removeNode = serverApi.removeHaTerminatedNode(nodeId);
        removeNode.then(data => {
            $scope.expectedNodeCounter--;
            $scope.container.dispatchEvent(new CustomEvent('update-states', {}));
        });
    }

    $scope.removeAllTerminatedNodes = function () {
        $scope.template = 'spinnerTemplate';
        let removeNodes = serverApi.removeHaTerminatedNodes();
        removeNodes.then(data => {
            Object.values($scope.states.nodes).forEach( ({ status }) => {
                if (status === "TERMINATED" || status === "FAILED") $scope.expectedNodeCounter--;
            });
            $scope.container.dispatchEvent(new CustomEvent('update-states', {}));
        });
    }

    $element.bind('update-states', (event) => {
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
            return moment(input).fromNow();
        }
    }
}