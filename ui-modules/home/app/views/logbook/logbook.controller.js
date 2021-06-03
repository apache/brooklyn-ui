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
import template from "./logbook.template.html";

const MODULE_NAME = 'states.logbook';

angular.module(MODULE_NAME, [uiRouter, serverApi])
    .config(['$stateProvider', logbookStateConfig]);

export default MODULE_NAME;

export const logbookState = {
    name: 'logbook',
    url: '/logbook',
    template: template,
    controller: ['$scope', 'brBrandInfo', 'version', 'states', 'logbookApi', logbookStateController],
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

export function logbookStateConfig($stateProvider) {
    $stateProvider.state(logbookState);
}

export function logbookStateController($scope, brBrandInfo, version, states, logbookApi) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    $scope.getBrandedText = brBrandInfo.getBrandedText;

    let vm = this;

    $scope.$on('logbook.query', () => {
        vm.doQuery();
    });

    vm.doQuery = function () {
        $scope.waitingResponse = true;

        const queryString = $scope.query;

        console.log("requesting: " + queryString);
        if (queryString === "") {
            logbookApi.getEntries($scope.from, $scope.numberOfItems, true).then(function (success) {
                $scope.results = success;
            }, function (error) {
                $scope.results = "Error getting the logs: \n" + JSON.stringify(error);
            }).finally(() => {
                $scope.waitingResponse = false;
            });
        } else {
            logbookApi.doQuery(queryString, true).then(function (success) {
                console.log("success: " + success) //todojd remove
                $scope.results = JSON.stringify({success});
            }, function (error) {
                console.log("error: " + error) //todojd remove
                $scope.results = "Something bad happened: " + error;
            }).finally(() => {
                $scope.waitingResponse = false;
            });
        }


    };

    $scope.query = "";
    $scope.results = "-empty-";
    $scope.from = -1;
    $scope.numberOfItems = 10;
    $scope.waitingResponse = false;
    $scope.logLevels = [{"name": "All", "value":"ALL"}, {"name": "Debug", "value":"DEBUG"}, {"name": "Info", "value":"INFO"}, {"name": "Warn", "value":"WARN"}, {"name": "Error", "value":"ERROR"}, {"name": "Fatal", "value":"FATAL"}];
    $scope.queryLevel =   $scope.logLevels[0].value;
}
