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
import uiRouter from 'angular-ui-router';
import serverApi from 'brooklyn-ui-utils/api/brooklyn/server.js';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from "./about.template.html";

const MODULE_NAME = 'states.about';
const BROOKLYN_VERSION = __BROOKLYN_VERSION__;
const BUILD_NAME = __BUILD_NAME__;   // if something embedding brooklyn
const BUILD_VERSION = __BUILD_VERSION__;   // if something embedding brooklyn
const BUILD_BRANCH = __BUILD_BRANCH__; 
const BUILD_COMMIT_ID = __BUILD_COMMIT_ID__;

angular.module(MODULE_NAME, [uiRouter, serverApi])
    .config(['$stateProvider', aboutStateConfig]);

export default MODULE_NAME;

export const aboutState = {
    name: 'about',
    url: '/about',
    template: template,
    controller: ['$scope', 'brBrandInfo', 'version', 'states', aboutStateController],
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

export function aboutStateController($scope, brBrandInfo, version, states) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    $scope.getBrandedText = brBrandInfo.getBrandedText;
    
    this.serverVersion = version.data;
    this.states = states.data;
    this.buildInfo = {
        buildVersion: BUILD_VERSION,
        buildName: BUILD_NAME,
        buildBranch: BUILD_BRANCH,
        buildCommitId: BUILD_COMMIT_ID,
        brooklynVersion: BROOKLYN_VERSION,
    };
}
