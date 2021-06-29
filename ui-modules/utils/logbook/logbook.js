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
import template from './logbook.template.html';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from '../interstitial-spinner/interstitial-spinner';

const MODULE_NAME = 'brooklyn.component.logbook';

angular.module(MODULE_NAME, [])
    .directive('brLogbook', logbook);

export default MODULE_NAME;

export function logbook() {

    return {
        template: template,
        controller: ['$scope', 'brBrandInfo', 'logbookApi', controller],
        controllerAs: 'vm'
    };

    function controller($scope, brBrandInfo, logbookApi) {
        $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
        $scope.getBrandedText = brBrandInfo.getBrandedText;

        let vm = this;

        $scope.$on('logbook.query', () => {
            vm.doQuery();
        });

        vm.getChecked = function (group) {
            let levels = [];
            group.forEach(function (item) {
                if (item.selected) levels.push(item.value);
            });
            return levels;
        }
        vm.doQuery = function () {
            $scope.waitingResponse = true;
            $scope.results = "Loading..."

            const levels = $scope.allLevels ? ['ALL'] : vm.getChecked($scope.logLevels);

            const params = {
                reverseOrder: $scope.reverseOrder,
                numberOfItems: $scope.numberOfItems,
                levels: levels,
                initTime: $scope.initTime,
                finalTime: $scope.finalTime,
            }

            logbookApi.logbookQuery(params, true).then(function (success) {
                // TODO implement logic for make output as table
                $scope.logEntries = success;
                $scope.results = vm.createLogOutputAsText($scope.logEntries);
            }, function (error) {
                $scope.results = "Error getting the logs: \n" + error.error.message;
                console.log(JSON.stringify(error));
            }).finally(() => {
                $scope.waitingResponse = false;
            });
        };

        vm.createLogOutputAsText = function (success) {
            let output = [];
            const fieldsToShow = vm.getChecked($scope.logFields);
            success.forEach(entry => {
                let outputLine = [];
                if (fieldsToShow.includes("datetime") && entry.timestamp)
                    outputLine.push(entry.timestamp);
                if (fieldsToShow.includes("taskId") && entry.taskId)
                    outputLine.push(entry.taskId);
                if (fieldsToShow.includes("entityIds") && entry.entityIds)
                    outputLine.push(entry.entityIds);
                if (fieldsToShow.includes("level") && entry.level)
                    outputLine.push(entry.level);
                if (fieldsToShow.includes("bundleId") && entry.bundleId)
                    outputLine.push(entry.bundleId);
                if (fieldsToShow.includes("class") && entry.class)
                    outputLine.push(entry.class);
                if (fieldsToShow.includes("threadName") && entry.threadName)
                    outputLine.push(entry.threadName);
                if (fieldsToShow.includes("message") && entry.message)
                    outputLine.push(entry.message);

                output.push(outputLine.join(" "));
            })
            return output.length > 0 ? output.join("\n") : "No results";
        }

        vm.resetForm = function () {
            $scope.numberOfItems = 10;
            $scope.allLevels = true
            $scope.logLevels = [
                {"name": "Debug", "value": "DEBUG", "selected": false},
                {"name": "Info", "value": "INFO ", "selected": false},
                {"name": "Warn", "value": "WARN ", "selected": false},
                {"name": "Error", "value": "ERROR", "selected": false},
                {"name": "Fatal", "value": "FATAL", "selected": false},
            ];
            $scope.fieldsToShow = ['datetime', 'class', 'message']
            $scope.logFields = [
                {"name": "Timestamp", "value": "datetime", "selected": true},
                {"name": "Task ID", "value": "taskId", "selected": false},
                {"name": "Entity IDs", "value": "entityIds", "selected": false},
                {"name": "Log level", "value": "level", "selected": true},
                {"name": "Bundle ID", "value": "bundleId", "selected": false},
                {"name": "Class", "value": "class", "selected": true},
                {"name": "Thread name", "value": "threadName", "selected": false},
                {"name": "Message", "value": "message", "selected": true},
            ];
            $scope.reverseOrder = false;
            $scope.initTime = "";
            $scope.finalTime = "";
        }

        $scope.$watch('allLevels', function (v) {
            if (!v) {
                if (vm.getChecked($scope.logLevels).length === 0) {
                    $scope.allLevels = true;
                } else {
                    return;
                }
            }
            for (let i = 0; i < $scope.logLevels.length; ++i) {
                $scope.logLevels[i].selected = false;
            }
        });
        $scope.$watch('logLevels', function (newVal, oldVal) {
            let selected = newVal.reduce(function (s, c) {
                return s + (c.selected ? 1 : 0);
            }, 0);
            if (selected === newVal.length || selected === 0) {
                $scope.allLevels = true;
            } else if (selected > 0) {
                $scope.allLevels = false;
            }
        }, true);
        $scope.$watch('logFields', function (newVal, oldVal) {
            if ($scope.logEntries !== "") {
                $scope.results = vm.createLogOutputAsText($scope.logEntries);
            }
        }, true);

        $scope.waitingResponse = false;
        vm.resetForm();
        $scope.logEntries = "";
        $scope.results = "-empty-"
    }
}


