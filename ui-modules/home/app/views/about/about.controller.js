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
    this.serverApi = serverApi;
    this.serverVersion = version.data;
    this.states = states.data;
    this.buildInfo = {
        buildVersion: BUILD_VERSION,
        buildName: BUILD_NAME,
        buildBranch: BUILD_BRANCH,
        buildCommitId: BUILD_COMMIT_ID,
        brooklynVersion: BROOKLYN_VERSION,
    };

    this.container = $element[0];
    this.now = Date.now();
    this.expectedNodeCounter = Object.keys(this.states.nodes).length;
    this.template = 'haStatusTemplate';

    let modalInstance = null;

    this.openDialog = function (states, nodeId, serverApi, container) {
        if (!modalInstance) {
            modalInstance = $uibModal.open({
                template: nodeManagementTemplate,
                controller: ['$scope', '$uibModalInstance', 'node', 'serverApi', nodeManagementController],
                controllerAs: 'vm',
                backdrop: 'static',
                windowClass: 'quick-launch-modal',
                size: 'md',
                resolve: {
                    node: function () {
                        return states.nodes[nodeId];
                    },
                    serverApi: function () {
                        return serverApi;
                    }
                }
            });
            modalInstance.result.then(
                (promiseList) => {
                    this.template = 'spinnerTemplate';
                    Promise.allSettled(promiseList).then((values) => {
                        let event = new CustomEvent('update-states', {});
                        container.dispatchEvent(event);
                    });
                    modalInstance = null;
                },
                () => {
                    this.template = 'spinnerTemplate';
                    let event = new CustomEvent('update-states', {});
                    container.dispatchEvent(event);
                    modalInstance = null;
                }
            );
        }

    };

    function nodeManagementController($scope, $uibModalInstance, node, serverApi) {

        let vm = this;

        vm.node = node;
        vm.newPriority = node.priority;
        vm.newStatus = node.status;
        vm.statuses = ["MASTER", "STANDBY", "HOT_STANDBY", "HOT_BACKUP"];
        vm.now = Date.now();
        vm.showEditOptions = false;

        vm.setHaStatus = function () {
            let result = serverApi.setHaStatus(vm.newStatus);
            vm.node.status = vm.newStatus;
        }

        vm.setHaPriority = function () {
            let result = serverApi.setHaPriority(vm.newPriority);
            vm.node.priority = vm.newPriority;
        }

        vm.applyChangesAndQuit = function () {
            let promiseList = [];
            if (vm.node.priority !== vm.newPriority) {
                let result = serverApi.setHaPriority(vm.newPriority);
                promiseList.push(result);
            }
            if (vm.node.status !== vm.newStatus) {
                let result = serverApi.setHaStatus(vm.newStatus);
                promiseList.push(result);
            }
            $uibModalInstance.close(promiseList);

        }

        vm.cancelAndQuit = function () {
            vm.newPriority = vm.node.priority;
            vm.newStatus = vm.node.status;
            $uibModalInstance.dismiss();
        }

        vm.setShowEditOptions = function (showEditOptions) {
            vm.showEditOptions = showEditOptions;
        }

    }

    this.removeNode = function (nodeId) {
        this.template = 'spinnerTemplate';
        let removeNode = serverApi.removeHaTerminatedNode(nodeId);
        removeNode.then(data => {
            this.expectedNodeCounter--;
            let event = new CustomEvent('update-states', {});
            this.container.dispatchEvent(event);
        });
    }

    this.removeAllTerminatedNodes = function () {
        this.template = 'spinnerTemplate';
        let removeNodes = serverApi.removeHaTerminatedNodes();
        removeNodes.then(data => {
            for (const node in this.states.nodes) {
                if (this.states.nodes[node].status === "TERMINATED") this.expectedNodeCounter--;
            }
            let event = new CustomEvent('update-states', {});
            this.container.dispatchEvent(event);
        });
    }

    $element.bind('update-states', (event) => {
        let updateStates = serverApi.getHaStates();
        updateStates.then(data => {
            if (Object.keys(data.data.nodes).length === this.expectedNodeCounter) {
                this.states = data.data;
                this.now = Date.now();
                this.template = 'haStatusTemplate';
            } else {
                let event = new CustomEvent('update-states', {});
                this.container.dispatchEvent(event);
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