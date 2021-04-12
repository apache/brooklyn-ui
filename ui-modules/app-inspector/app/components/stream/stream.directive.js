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
import angular from "angular";
import template from './stream.template.html';

const MODULE_NAME = 'inspector.stream';

angular.module(MODULE_NAME, [])
    .directive('stream', streamDirective);

export default MODULE_NAME;

export function streamDirective() {
    return {
        template: template,
        restrict: 'E',
        scope: {
            autoUpdate: '=?',
            tail: '=?',
            activityId: '@',
            streamType: '@',
        },
        controller: ['$scope', '$interval', '$element', 'activityApi', controller]
    };

    function controller($scope, $interval, $element, activityApi) {
        $scope.autoUpdate = $scope.autoUpdate !== false;
        $scope.tail = $scope.tail !== false;

        // Content filtering features
        $scope.filteredStream = [];
        $scope.streamProcessedUpTo = 0;
        $scope.isDisplayOther = $scope.isDisplayOther !== false;
        $scope.isDisplayError = $scope.isDisplayError !== false;
        $scope.isDisplayDebug = $scope.isDisplayDebug !== false;
        $scope.isDisplayTrace = $scope.isDisplayTrace !== false;
        $scope.isDisplayWarning = $scope.isDisplayWarning !== false;
        $scope.isFilterContent = isFilterContent;
        $scope.isDisplayFormattedItem = isDisplayFormattedItem;
        $scope.getFormattedItemLogLevel = getFormattedItemLogLevel;

        // CLI XML features
        $scope.cliXml = false;
        $scope.cliXmlIdentified = false;
        $scope.toggleCliXml = toggleCliXml;
        $scope.isCliXmlSupported = isCliXmlSupported;
        $scope.cliXmlVerificationRequired = isWinRmStream(); // CLI XML verification is required only when stream is WinRM

        let autoScrollableElement = Array.from(document.getElementsByClassName('auto-scrollable'));
        let refreshFunction;

        autoScrollableElement.forEach(item => {
            if (item.addEventListener)
            {
                let wheelHandler = () => {
                    $scope.$apply(() => {
                        $scope.tail = (item.scrollTop + item.offsetHeight) >= item.scrollHeight;
                    });
                }
                // IE9, Chrome, Safari, Opera
                item.addEventListener("mousewheel", wheelHandler, false);
                // Firefox
                item.addEventListener("DOMMouseScroll", wheelHandler, false);
            }

        });

        $scope.$watch('tail', () => {
            if ($scope.tail) {
                $scope.$applyAsync(() => {
                    autoScrollableElement.forEach(item => item.scrollTop = item.scrollHeight);
                });
            }
        });

        $scope.$watch('autoUpdate', ()=> {
            if ($scope.autoUpdate) {
                refreshFunction = $interval(updateStream, 1000);
            } else {
                cancelUpdate();
            }
        });
        $scope.$on('$destroy', cancelUpdate);

        /**
         * Updates the stream data.
         */
        function updateStream() {
            activityApi.activityStream($scope.activityId, $scope.streamType).then((response)=> {

                // 1. Try to identify CLI XML output.
                const CLI_XML_HEADER_SIZE = 100; // estimated headers size in WinRM that can contain indication of CLI XML output
                if ($scope.cliXmlVerificationRequired && typeof response.data === 'string' && response.data.length >= CLI_XML_HEADER_SIZE) {
                    let header = response.data.slice(0, CLI_XML_HEADER_SIZE);
                    if (header.includes('#< CLIXML') || header.includes('xmlns="http://schemas.microsoft.com/powershell')) {
                        $scope.cliXmlIdentified = true;
                    }
                    $scope.cliXmlVerificationRequired = false; // perform verification once, if conditions match
                }

                // 2. Update the stream data holder in this directive.
                $scope.stream = response.data;

                // 3. Filter the content where relevant and display it.
                updateFilteredContent();

            }).catch((error)=> {
                if (error.data) {
                    $scope.error = error.data.message;
                }
            }).finally(() => {
                if ($scope.tail) {
                    $scope.$applyAsync(() => {
                        autoScrollableElement.forEach(item => item.scrollTop = item.scrollHeight);
                    });
                }
            })
        }

        /**
         * Cancels the auto-update of the streamed content.
         */
        function cancelUpdate() {
            if (refreshFunction) {
                $interval.cancel(refreshFunction);
            }
        }

        /**
         * @returns {boolean} True if CLI XML is supported, and false otherwise. CLI XML is expected in WinRM stream only.
         */
        function isCliXmlSupported() {
            return isWinRmStream() && $scope.cliXmlIdentified === true;
        }

        /**
         * @returns {boolean} True stream type is WinRM, and false otherwise.
         */
        function isWinRmStream() {
            return $scope.streamType === 'winrm';
        }

        /**
         * Switches content format to CLI XML and back.
         */
        function toggleCliXml() {
            $scope.cliXml = !$scope.cliXml;
            updateFilteredContent();
        }

        /**
         * @returns {boolean} True if logging filter should be displayed, and false otherwise.
         */
        function isFilterContent() {
            return isCliXmlSupported() && $scope.cliXml !== true;
        }

        /**
         * @returns {string} Returns class name of the formatted item log level.
         */
        function getFormattedItemLogLevel(formattedItem) {
            if (formattedItem.isWarning) {
                return 'log-warning';
            } else  if (formattedItem.isError) {
                return 'log-error';
            } if (formattedItem.isDebug) {
                return 'log-debug';
            }
            return 'log-trace';
        }

        /**
         * @returns {boolean} True if formatted item should be displayed, and false otherwise.
         */
        function isDisplayFormattedItem(formattedItem) {
            return !!(formattedItem.isWarning && $scope.isDisplayWarning
                || formattedItem.isDebug && $scope.isDisplayDebug
                || formattedItem.isError && $scope.isDisplayError
                || formattedItem.isTrace & $scope.isDisplayTrace
                || formattedItem.isOther && $scope.isDisplayOther);
        }

        /**
         * Formats CLI XML output and displays it in 'filtered-stream-content' field.
         */
        function formatCliXmlContent() {

            // Slice at index of last closing tag ending wth the new line
            let streamTags = $scope.stream.match(/<\/(.*?)>\n/g);
            let lastClosingTagIndex  = $scope.stream.lastIndexOf(streamTags[streamTags.length-1]);
            let newCliXmlData = $scope.stream.slice($scope.streamProcessedUpTo, lastClosingTagIndex);
            if (!newCliXmlData) {
                return;
            }

            $scope.streamProcessedUpTo += newCliXmlData.length;

            newCliXmlData.split(/\n/g).forEach(item => {
                let formattedItem = {
                    id: ($scope.filteredStream.length), // ng-repeat requires unique items, array length fits the bill
                    text: item,
                    isOther: false,
                    isError: false,
                    isDebug: false,
                    isTrace: false,
                    isWarning: false
                };

                if (/<s s="warning">/i.test(item)) {
                    formattedItem.isWarning = true;
                } else if (/<s s="debug">/i.test(item)) {
                    formattedItem.isDebug = true;
                } else if (/<s s="verbose">/i.test(item)) {
                    formattedItem.isTrace = true;
                } else if (/<s s="error">/i.test(item)) {
                    formattedItem.isError = true;
                } else {
                    formattedItem.isOther = true;
                }

                // Remove CLI XML string tags for know log levels
                if (!formattedItem.isOther) {
                    formattedItem.text = item.replace(/<s s="(.*?)">|\t/gi, '');
                }

                // Remove CLI XML markers, newlines and replace tabs with spaces
                formattedItem.text = formattedItem.text.replace(/<\/s>|_x000[a-z0-9]_|\n/gi, '').replace(/\t/g,' ');

                // Push update item and let ng-repeat update the content
                $scope.filteredStream.push(formattedItem);
            });
        }

        /**
         * Filters stream content as per selected filters if filtering is enabled, e.g. display/hide warnings or errors.
         */
        function updateFilteredContent() {

            if (!isFilterContent()) {
                return;
            }

            // Format new CLI XML content
            if (isCliXmlSupported()) {
                formatCliXmlContent();
            }
        }

        updateStream();
    }
}

