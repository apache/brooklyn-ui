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

        let from = $scope.from;
        if($scope.reverseOrder){
            from = from === 0? -1 : -from
        }
        const params = {
            from:from,
            numberOfItems:$scope.numberOfItems,
            logLevel:$scope.queryLevel
        }
        logbookApi.logbookQuery(params, true).then(function (success) {
            // TODO implement logic for make output as table
            $scope.results = vm.createLogOutputAsText(success);
        }, function (error) {
            $scope.results = "Error getting the logs: \n" + JSON.stringify(error);
        }).finally(() => {
            $scope.waitingResponse = false;
        });
    };

    vm.createLogOutputAsText = function (success) {
        let output=[];
        success.forEach(entry=>{
            let outputLine = [];
            outputLine.push(entry.timestamp || "");
            outputLine.push(entry.taskId || "");
            outputLine.push(entry.entityIds || "");
            outputLine.push(entry.level || "");
            outputLine.push(entry.bundleId || "");
            outputLine.push(entry.class || "");
            outputLine.push(entry.threadName || "");
            outputLine.push(entry.message || "");;
            output.push(outputLine.join(" "));
        })
        return output.join("\n");
    }

    $scope.results = "-empty-";
    $scope.from = 0;
    $scope.numberOfItems = 10;
    $scope.waitingResponse = false;
    $scope.logLevels = [{"name": "All", "value": "ALL"}, {"name": "Debug", "value": "DEBUG"}, {
        "name": "Info",
        "value": "INFO"

    }, {"name": "Warn", "value": "WARN"}, {"name": "Error", "value": "ERROR"}, {"name": "Fatal", "value": "FATAL"}];
    $scope.queryLevel = $scope.logLevels[0].value;
    $scope.reverseOrder = true;
}
