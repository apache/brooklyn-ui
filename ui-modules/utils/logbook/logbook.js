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

        let vm = this;
        let refreshFunction = null;
        let autoScrollableElement = Array.from($element.find('pre')).find(item => item.classList.contains('auto-scrollable'));
        let isNewQueryParameters = true; // Fresh start, new parameters!
        let dateTimeToAutoRefreshFrom = '';
        let datetimeToScrollTo = null;

        // Set up cancellation of auto-scrolling down.
        if (autoScrollableElement.addEventListener) {
            let wheelHandler = () => {
                $scope.$apply(() => {
                    cacheDatetimeToScrollTo();
                    $scope.isAutoScrollDown = (autoScrollableElement.scrollTop + autoScrollableElement.offsetHeight) >= autoScrollableElement.scrollHeight;
                });
            }
            // Chrome, Safari, Opera
            autoScrollableElement.addEventListener("mousewheel", wheelHandler, false);
            // Firefox
            autoScrollableElement.addEventListener("DOMMouseScroll", wheelHandler, false);
        }

        $scope.isAutoScrollDown = true; // Auto-scroll down, by default.
        $scope.autoRefresh = false;
        $scope.waitingResponse = false;
        $scope.logtext = '';
        $scope.wordwrap = true;
        $scope.logEntries = [];

        // Initialize search parameters.
        $scope.search = {
            logLevels: [
                {name: 'Info',  value: 'INFO',  selected: true},
                {name: 'Warn',  value: 'WARN',  selected: true},
                {name: 'Error', value: 'ERROR', selected: true},
                {name: 'Fatal', value: 'FATAL', selected: true},
                {name: 'Debug', value: 'DEBUG', selected: true},
            ],
            latest: true,
            dateTimeFrom: '',
            dateTimeTo: '',
            numberOfItems: DEFAULT_NUMBER_OF_ITEMS,
            phrase: ''
        };

        // Define search result filters.
        $scope.fieldsToShow = ['datetime', 'class', 'message']
        $scope.logFields = [
            {name: 'Timestamp',   value: 'datetime',   selected: true},
            {name: 'Task ID',     value: 'taskId',     selected: false},
            {name: 'Entity IDs',  value: 'entityIds',  selected: false},
            {name: 'Log level',   value: 'level',      selected: true},
            {name: 'Bundle ID',   value: 'bundleId',   selected: false},
            {name: 'Class',       value: 'class',      selected: true},
            {name: 'Thread name', value: 'threadName', selected: false},
            {name: 'Message',     value: 'message',    selected: true},
        ];

        // Watch for search parameters changes.
        $scope.$watch('search', () => {
            // Restart the auto-refresh.
            if ($scope.autoRefresh) {
                stopAutoRefresh();
                vm.singleQuery();
                startAutoRefresh();
            }
        }, true);

        $scope.$watch('search.latest', () => {
            datetimeToScrollTo = null;
            if ($scope.search.latest) {
                scrollToMostRecentLogEntry();
            } else {
                scrollToFirstLogEntry();
            }
        }, true);

        // Watch for auto-update events.
        $scope.$watch('autoRefresh', () => {
            if ($scope.autoRefresh) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });

        $scope.$on('$destroy', stopAutoRefresh);

        /**
         * Handles the click event on the log entry.
         *
         * @param {Object} logEntry The clicked log entry data.
         */
        vm.logEntryOnClick = (logEntry) => {
            pinLogEntry(logEntry);
        };

        /**
         * Starts an auto-query. Performs new query each time search parameters change.
         */
        vm.autoQuery = () => {
            let autoRefresh = !$scope.autoRefresh; // Calculate new value first.

            if (autoRefresh) {
                $scope.isAutoScrollDown = true;
                doQuery();
            }

            $scope.autoRefresh = autoRefresh; // Now, set the new value.
        };

        /**
         * Performs a single query with search parameters selected.
         */
        vm.singleQuery = () => {
            isNewQueryParameters = true;
            $scope.waitingResponse = true;
            $scope.logtext = 'Loading...';
            $scope.logEntries = [];
            doQuery();
        };

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
        };

        /**
         * Caches the datetime of the first item in the visible area of the query result.
         */
        function cacheDatetimeToScrollTo() {
            let element = Array.from($element.find('pre')).find(item => item.offsetTop > (autoScrollableElement.scrollTop + autoScrollableElement.offsetTop - 1));
            let firstLogEntryInTheVisibleArea = $scope.logEntries.find(item => item.id === element.id);
            if (firstLogEntryInTheVisibleArea) {
                datetimeToScrollTo = firstLogEntryInTheVisibleArea.datetime;
            }
        }

        /**
         * @returns {boolean} true if current query is a tail request, false otherwise.
         */
        function isTail() {
            return $scope.search.latest && !$scope.search.dateTimeTo;
        }

        /**
         * Performs a logbook query.
         */
        function doQuery() {

            const levels = getCheckedBoxes($scope.search.logLevels);

            const params = {
                levels: levels,
                tail: $scope.search.latest,
                searchPhrase: $scope.search.phrase,
                numberOfItems: $scope.search.numberOfItems,
                dateTimeFrom: isTail() && !isNewQueryParameters ? dateTimeToAutoRefreshFrom : $scope.search.dateTimeFrom,
                dateTimeTo: $scope.search.dateTimeTo,
            }

            logbookApi.logbookQuery(params, true).then((logEntries) => {

                // Assign unique IDs for new log entries.
                logEntries.forEach(item => item.id = generateLogEntryId());

                if (logEntries.length > 0 && isTail() && $scope.autoRefresh && !isNewQueryParameters) {

                    // Calculate date-time to display up to. Note, calendar does not take into account milliseconds, round down to seconds.
                    let dateTimeOfLastLogEntry = Math.floor(logEntries.slice(-1)[0].datetime / DEFAULT_NUMBER_OF_ITEMS) * DEFAULT_NUMBER_OF_ITEMS;
                    let dateTimeFrom = new Date($scope.search.dateTimeFrom).getTime();

                    if (dateTimeOfLastLogEntry > dateTimeFrom) {

                        // Display new log entries.
                        let newLogEntries = logEntries.filter(({datetime}) => datetime <= dateTimeOfLastLogEntry);
                        $scope.logEntries = $scope.logEntries.concat(newLogEntries).slice(-DEFAULT_NUMBER_OF_ITEMS);

                        // Optimize auto-refresh: cache next date-time to query tail from, if it is still a tail.
                        dateTimeToAutoRefreshFrom = dateTimeOfLastLogEntry;

                    } else {
                        // Or re-set the cached value.
                        dateTimeToAutoRefreshFrom = '';
                    }
                } else {
                    $scope.logEntries = logEntries;
                }

                // Auto-scroll.
                if ($scope.logEntries.length > 0) {
                    if ($scope.isAutoScrollDown) {
                        scrollToMostRecentLogEntry();
                    } else if (datetimeToScrollTo && datetimeToScrollTo >= $scope.logEntries[0].datetime) {
                        scrollToLogEntryWithDateTime(datetimeToScrollTo);
                    }
                }

                // Re-set marker for search parameters changes after auto-scroll.
                isNewQueryParameters = false;

                if ($scope.logEntries.length === 0) {
                    $scope.logtext = 'No results.';
                }

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
         * Starts the auto-refresh of the logbook content.
         */
        function startAutoRefresh() {
            refreshFunction = $interval(() => {
                // Do a new query only if parameters have changed or it is a tail.
                if (isNewQueryParameters || isTail()) {
                    doQuery();
                }
            }, 1000);
        }

        /**
         * Stops the auto-refresh of the logbook content.
         */
        function stopAutoRefresh() {
            if (refreshFunction) {
                $interval.cancel(refreshFunction);
                dateTimeToAutoRefreshFrom = '';
            }
        }

        /**
         * Scrolls down to the most recent log entry.
         */
        function scrollToMostRecentLogEntry() {
            $scope.$applyAsync(() => {
                autoScrollableElement.scrollTop = autoScrollableElement.scrollHeight;
            });
        }

        /**
         * Scrolls up to the first log entry.
         */
        function scrollToFirstLogEntry() {
            $scope.$applyAsync(() => {
                autoScrollableElement.scrollTop = 0;
            });
        }

        /**
         * Scrolls down or up to the log entry with the closets datetime of interest.
         *
         * @param {Object} datetime The datetime of the log entry to scroll to.
         */
        function scrollToLogEntryWithDateTime(datetime) {
            $scope.$applyAsync(() => {
                let logEntryWithDateTimeToScrollTo = $scope.logEntries.find(item => item.datetime >= datetime);
                if (logEntryWithDateTimeToScrollTo) {
                    let elementWithDateTimeToScrollTo = Array.from($element.find('pre')).find(item => item.id === logEntryWithDateTimeToScrollTo.id);
                    if (logEntryWithDateTimeToScrollTo) {
                        autoScrollableElement.scrollTop = elementWithDateTimeToScrollTo.offsetTop - autoScrollableElement.offsetTop;
                    }
                }
            });
        }

        /**
         * @returns {String} Randomly generated log book entry ID.
         */
        function generateLogEntryId() {
            const LOG_ENTRY_PREFIX = 'le-';
            return LOG_ENTRY_PREFIX + Math.random().toString(36).slice(2);
        }

        /**
         * Pins the log entry. Pinned log entry is displayed even if it is not present in the new query, until unpinned.
         *
         * @param {Object} logEntry The log entry to pin.
         */
        function pinLogEntry(logEntry) {
            // TODO: reserved for future. Pinning requires unique IDs assigned to log entries in the backed.
            // logEntry.isPinned = !logEntry.isPinned;
        }
    }
}


