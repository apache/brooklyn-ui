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

const MODULE_NAME = 'brooklyn.component.logbook';

angular.module(MODULE_NAME, [])
    .directive('brLogbook', logbook);

export default MODULE_NAME;

export function logbook() {

    return {
        template: template,
        controller: ['$scope', '$element', '$interval', 'brBrandInfo', 'logbookApi', controller],
        controllerAs: 'vm'
    };

    function controller($scope, $element, $interval, brBrandInfo, logbookApi) {

        const DEFAULT_NUMBER_OF_ITEMS = 1000;

        $scope.isAutoScroll = true; // Auto-scroll by default.
        $scope.isLatest = true; // Indicates whether to query tail (last number of lines) or head (by default).
        $scope.autoUpdate = false;
        $scope.waitingResponse = false;

        $scope.logtext = '';
        $scope.logEntries = [];

        let vm = this;
        let refreshFunction = null;
        let autoScrollableElements = Array.from($element.find('pre')).filter(item => item.classList.contains('auto-scrollable'));
        let dateTimeToAutoUpdateFrom = '';

        // Set up cancellation of auto-scrolling on scrolling up.
        autoScrollableElements.forEach(item => {
            if (item.addEventListener) {
                let wheelHandler = () => {
                    $scope.$apply(() => {
                        $scope.isAutoScroll = (item.scrollTop + item.offsetHeight) >= item.scrollHeight;
                    });
                }
                // Chrome, Safari, Opera
                item.addEventListener("mousewheel", wheelHandler, false);
                // Firefox
                item.addEventListener("DOMMouseScroll", wheelHandler, false);
            }
        });

        $scope.$watch('allLevels', (value) => {
            if (!value) {
                if (getCheckedBoxes($scope.logLevels).length === 0) {
                    $scope.allLevels = true;
                } else {
                    return;
                }
            }
            for (let i = 0; i < $scope.logLevels.length; ++i) {
                $scope.logLevels[i].selected = false;
            }
        });

        $scope.$watch('logLevels', (newVal, oldVal) => {
            let selected = newVal.reduce(function (s, c) {
                return s + (c.selected ? 1 : 0);
            }, 0);
            if (selected === newVal.length || selected === 0) {
                $scope.allLevels = true;
            } else if (selected > 0) {
                $scope.allLevels = false;
            }
        }, true);

        $scope.$watch('autoUpdate', ()=> {
            if ($scope.autoUpdate) {
                refreshFunction = $interval(doQuery, 1000);
            } else {
                cancelAutoUpdate();
            }
        });

        $scope.$on('$destroy', cancelAutoUpdate);

        // Watch the 'isAutoScroll' and auto-scroll down if enabled.
        $scope.$watch('isAutoScroll', () => {
            if ($scope.isAutoScroll) {
                scrollToMostRecentRecords();
            }
        });

        // Initialize query parameters, reset them.
        resetQueryParameters();

        // Initialize the reset of search parameters.
        $scope.allLevels = true
        $scope.logLevels = [
            {"name": "Info", "value": "INFO", "selected": false},
            {"name": "Warn", "value": "WARN", "selected": false},
            {"name": "Error", "value": "ERROR", "selected": false},
            {"name": "Fatal", "value": "FATAL", "selected": false},
            {"name": "Debug", "value": "DEBUG", "selected": false},
        ];
        $scope.searchPhrase = '';

        // Initialize filters.
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

        /**
         * Queries latest log items with applied search parameters.
         */
        vm.queryTail = () => {
            let autoUpdate = !$scope.autoUpdate; // Calculate new value.

            if (autoUpdate) {
                $scope.isAutoScroll = true;
                resetQueryParameters();
                doQuery();
            }

            $scope.autoUpdate = autoUpdate; // Set new value.
        }

        /**
         * Queries first log items with applied search parameters.
         */
        vm.queryHead = () => {
            $scope.waitingResponse = true;
            $scope.autoUpdate = false;
            $scope.isLatest = false;
            $scope.logtext = 'Loading...';
            $scope.logEntries = [];
            doQuery();
        }

        /**
         * Converts log entry to string.
         *
         * @param {Object} entry The log entry to convert.
         * @returns {String} log entry converted to string.
         */
        vm.covertLogEntryToString = (entry) => {
            let fieldsToShow = getCheckedBoxes($scope.logFields);
            let outputLine = [];
            if (fieldsToShow.includes('datetime') && entry.timestamp)
                outputLine.push(entry.timestamp);
            if (fieldsToShow.includes('taskId') && entry.taskId)
                outputLine.push(entry.taskId);
            if (fieldsToShow.includes('entityIds') && entry.entityIds)
                outputLine.push(entry.entityIds);
            if (fieldsToShow.includes('level') && entry.level)
                outputLine.push(entry.level);
            if (fieldsToShow.includes('bundleId') && entry.bundleId)
                outputLine.push(entry.bundleId);
            if (fieldsToShow.includes('class') && entry.class)
                outputLine.push(entry.class);
            if (fieldsToShow.includes('threadName') && entry.threadName)
                outputLine.push(entry.threadName);
            if (fieldsToShow.includes('message') && entry.message)
                outputLine.push(entry.message);

            return outputLine.join(' ');
        }

        /**
         * Performs a logbook query.
         */
        function doQuery() {
            const levels = $scope.allLevels ? ['ALL'] : getCheckedBoxes($scope.logLevels);

            const params = {
                levels: levels,
                tail: $scope.isLatest,
                searchPhrase: $scope.searchPhrase,
                numberOfItems: $scope.numberOfItems,
                dateTimeFrom: $scope.isLatest ? dateTimeToAutoUpdateFrom : $scope.dateTimeFrom,
                dateTimeTo: $scope.isLatest ? '' : $scope.dateTimeTo,
            }

            logbookApi.logbookQuery(params, true).then((logEntries) => {

                // TODO: generate IDs in the backend, and remove this workaround.
                const generateId = () => Math.random().toString(36).slice(2);
                logEntries.forEach(item => item.id = generateId());

                if ($scope.isLatest && $scope.logEntries.length !== 0) {
                    if (logEntries.length > 0) {

                        // Calculate date-time to display up to. Note, calendar does not take into account milliseconds,
                        // round down to seconds.
                        let latestDateTimeToDisplay = Math.floor(logEntries.slice(-1)[0].datetime / DEFAULT_NUMBER_OF_ITEMS) * DEFAULT_NUMBER_OF_ITEMS;

                        // Display new log entries.
                        let newLogEntries = logEntries.filter(({datetime}) => datetime <= latestDateTimeToDisplay);
                        $scope.logEntries = $scope.logEntries.concat(newLogEntries).slice(-DEFAULT_NUMBER_OF_ITEMS);

                        // Cache next date-time to query tail from.
                        dateTimeToAutoUpdateFrom = new Date(latestDateTimeToDisplay);
                    } else {
                        // Or re-set the cache.
                        dateTimeToAutoUpdateFrom = '';
                    }
                } else {
                    $scope.logEntries = logEntries;
                }

                scrollToMostRecentRecords();
            }, (error) => {
                $scope.logtext = 'Error getting the logs: \n' + error.error.message;
                console.log(JSON.stringify(error));
            }).finally(() => {
                $scope.waitingResponse = false;
            });
        }

        /**
         * Gets all checked boxes from the group of elements.
         *
         * @param {Object} checkBoxGroup The checkbox group.
         * @returns {Array.<Object>} The checked boxes.
         */
        function getCheckedBoxes(checkBoxGroup) {
            let checkedBoxes = [];
            checkBoxGroup.forEach((item) => {
                if (item.selected) {
                    checkedBoxes.push(item.value);
                }
            });
            return checkedBoxes;
        }

        /**
         * Resets query parameters.
         */
        function resetQueryParameters() {
            $scope.numberOfItems = DEFAULT_NUMBER_OF_ITEMS;
            $scope.dateTimeFrom = '';
            $scope.dateTimeTo = '';
            $scope.isLatest = true;
        }

        /**
         * Cancels the auto-update of the logbook content.
         */
        function cancelAutoUpdate() {
            if (refreshFunction) {
                $interval.cancel(refreshFunction);
                dateTimeToAutoUpdateFrom = '';
            }
        }

        /**
         * Scrolls down to the most recent records.
         */
        function scrollToMostRecentRecords() {
            $scope.$applyAsync(() => {
                if ($scope.logEntries.length > 0 && $scope.isAutoScroll) {
                    autoScrollableElements.forEach(item => item.scrollTop = item.scrollHeight);
                }
            });
        }
    }
}


