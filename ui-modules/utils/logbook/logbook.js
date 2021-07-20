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

        let vm = this;
        let refreshFunction = null;
        let autoScrollableElement = Array.from($element.find('pre')).find(item => item.classList.contains('auto-scrollable'));
        let isNewQueryParameters = true; // Fresh start, new parameters!
        let datetimeToScrollTo = '';

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
        $scope.minNumberOfItems = 1;
        $scope.maxNumberOfItems = 10000;

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
            numberOfItems: 1000,
            phrase: ''
        };

        // Define search result filters.
        $scope.fieldsToShow = ['timestamp', 'class', 'message']
        $scope.logFields = [
            {name: 'Timestamp',   value: 'timestamp',  selected: true},
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
            isNewQueryParameters = true;
            if ($scope.autoRefresh) {
                $scope.logEntries = [];
            }
        }, true);

        $scope.$watch('search.latest', () => {
            datetimeToScrollTo = '';
            $scope.isAutoScrollDown = $scope.search.latest;
            if ($scope.search.latest) {
                scrollToMostRecentLogEntry();
            } else {
                scrollToFirstLogEntry();
            }
        }, true);

        $scope.$on('$destroy', stopAutoRefresh);

        /**
         * @returns {boolean} True if number of items is a number and within a supported range, false otherwise.
         */
        vm.isValidNumber = () => {
            return $scope.search.numberOfItems >= $scope.minNumberOfItems && $scope.search.numberOfItems <= $scope.maxNumberOfItems;
        }

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
                vm.singleQuery();
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }

            $scope.autoRefresh = autoRefresh; // Now, set the new value.
        };

        /**
         * Performs a single query with search parameters selected.
         */
        vm.singleQuery = () => {
            isNewQueryParameters = true;
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
            return getCheckedBoxes($scope.logFields).reduce((output, fieldKey) => {
                    if (entry[fieldKey]) {
                        output.push(entry[fieldKey])
                    }
                    return output;
                }, []).join(' ');
        }

        /**
         * Caches the datetime of the first item in the visible area of the query result.
         */
        function cacheDatetimeToScrollTo() {
            let element = Array.from($element.find('pre')).find(item => item.offsetTop > (autoScrollableElement.scrollTop + autoScrollableElement.offsetTop - 1));
            let firstLogEntryInTheVisibleArea = $scope.logEntries.find(logEntry => logEntry.lineId === element.id);
            if (firstLogEntryInTheVisibleArea) {
                datetimeToScrollTo = getLogEntryTimestamp(firstLogEntryInTheVisibleArea);
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

            // Do not start new query until one is in progress.
            if ($scope.waitingResponse) {
                return;
            }
            $scope.waitingResponse = true;

            if (!vm.isValidNumber()) {
                console.error('number of items is invalid', $scope.search.numberOfItems)
                return;
            }

            // Take into account timezone offset of the browser.
            let dateTimeFrom = getUtcTimestamp($scope.search.dateTimeFrom);
            let dateTimeTo = getUtcTimestamp($scope.search.dateTimeTo)
            if (isTail() && !isNewQueryParameters && $scope.logEntries.length > 0) {
                dateTimeFrom = getUtcTimestamp(getLogEntryTimestamp($scope.logEntries.slice(-1)[0]))
            }

            const levels = getCheckedBoxes($scope.search.logLevels);

            const params = {
                levels: levels,
                tail: $scope.search.latest,
                searchPhrase: $scope.search.phrase,
                numberOfItems: $scope.search.numberOfItems,
                dateTimeFrom: dateTimeFrom,
                dateTimeTo: dateTimeTo,
            }

            let isNewQueryParametersForThisQuery = isNewQueryParameters;

            logbookApi.logbookQuery(params, true).then((newLogEntries) => {

                if (isNewQueryParametersForThisQuery) {

                    // New query.

                    // Re-draw all entries.
                    $scope.logEntries = newLogEntries;

                } else if (newLogEntries.length > 0 && $scope.logEntries.length > 0 && isTail() && $scope.autoRefresh) {

                    // Tail query.

                    // Use line IDs to resolve the overlap, if any.
                    let lastLogEntryDisplayed = $scope.logEntries[$scope.logEntries.length - 1];
                    let indexOfLogEntryInTheNewBatch = newLogEntries.findIndex(({lineId}) => lineId === lastLogEntryDisplayed.lineId);
                    if (indexOfLogEntryInTheNewBatch >= 0) {

                        // Append new log entries without overlap.
                        $scope.logEntries = $scope.logEntries.concat(newLogEntries.slice(indexOfLogEntryInTheNewBatch + 1));


                    } else {

                        // Append all new log entries, there is no overlap.
                        $scope.logEntries = $scope.logEntries.concat(newLogEntries)

                    }

                    // Display not more of lines than was requested.
                    $scope.logEntries.slice(-$scope.search.numberOfItems);

                }

                // Auto-scroll.
                if ($scope.logEntries.length > 0) {
                    if ($scope.isAutoScrollDown) {
                        scrollToMostRecentLogEntry();
                    } else if (datetimeToScrollTo && datetimeToScrollTo >= getLogEntryTimestamp($scope.logEntries[0])) {
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
         * Extracts timestamp from the log entry.
         *
         * @param logEntry The log entry.
         * @returns {number} The extracted date-time.
         */
        function getLogEntryTimestamp(logEntry) {
            return Date.parse(logEntry.timestamp.replace(',', '.'))
        }

        /**
         * Extracts UTC timestamp from the date.
         *
         * @param {Date|number} date The date to get UTC timestamp of.
         * @returns {number|undefined} The UTC timestamp.
         */
        function getUtcTimestamp(date) {
            const timezoneOffsetMs = new Date().getTimezoneOffset() * 60 * 1000;
            if (date instanceof Date) {
                return date.valueOf() - timezoneOffsetMs;
            } else if (typeof date === 'number') {
                return date - timezoneOffsetMs;
            } else {
                return undefined;
            }
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
                let logEntryWithDateTimeToScrollTo = $scope.logEntries.find(logEntry => getLogEntryTimestamp(logEntry) >= datetime);
                if (logEntryWithDateTimeToScrollTo) {
                    let elementWithDateTimeToScrollTo = Array.from($element.find('pre')).find(element => element.id === logEntryWithDateTimeToScrollTo.lineId);
                    if (logEntryWithDateTimeToScrollTo) {
                        autoScrollableElement.scrollTop = elementWithDateTimeToScrollTo.offsetTop - autoScrollableElement.offsetTop;
                    }
                }
            });
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


