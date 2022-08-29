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
import ngSanitize from "angular-sanitize";
import ngClipboard from "ngclipboard";
import template from "./config-sensor-table.template.html";
import jsyaml from 'js-yaml';
import { isSensitiveFieldName } from "brooklyn-ui-utils/sensitive-field/sensitive-field";

const MODULE_NAME = 'inspector.config-sensor.table';

angular.module(MODULE_NAME, [ngSanitize, ngClipboard])
    .directive('configSensorTable', ['brSnackbar', configSensorTableDirective])
    .filter('brLinky', ['$filter', '$state', '$sanitize', brLinkyFilter]);

export default MODULE_NAME;

export function configSensorTableDirective(brSnackbar) {
    return {
        restrict: 'E',
        template: template,
        scope: {
            data: '=',
            info: '=',
            checkPlaintextSensitiveKeyValue: '<',
            reconfigureCallback: '<',
        },
        link,
    };

    function link(scope) {
        scope.items = [];
        scope.mapInfo = {};
        scope.WARNING_TEXT = 'This value is identified as potentially sensitive based and so is masked here. ' +
            'The value should be supplied as a DSL expression not as plain text. ' +
            'Note that the unmasked value still might not reveal the actual value, ' +
            'if sensitive values are blocked by the API or if DSL resolution is skipped.';

        scope.$watchGroup(['data'], (changes)=> {
            if (angular.isObject(scope.data)) {
                const dataPlusReconfigurable = Object.assign({}, scope.data);
                if (scope.info) {
                    scope.info.forEach(info => {
                        if (info.reconfigurable && !dataPlusReconfigurable.hasOwnProperty(info.name)) {
                            dataPlusReconfigurable[info.name] = undefined;
                        }
                    });
                }
                scope.items = Object.entries(dataPlusReconfigurable)
                    .map(([key, value]) => ({
                        key,
                        value,
                        isPlaintextSensitiveValue: scope.checkPlaintextSensitiveKeyValue && scope.checkPlaintextSensitiveKeyValue(key, value),
                    }));
            }
        });

        scope.$watch('info', () => {
            if (angular.isArray(scope.info)) {
                scope.mapInfo = scope.info.reduce((pool, infoItem) => {
                    pool[infoItem.name] = infoItem;
                    return pool;
                }, {});
            }
        });

        scope.onClipboardSuccess = (e)=> {
            angular.element(e.trigger).triggerHandler('copied');
            e.clearSelection();
        };
        scope.onClipboardError = (e)=> {
            let message = '';
            let actionKey = e.action === 'cut' ? 'X' : 'C';
            if(/iPhone|iPad/i.test(navigator.userAgent)) {
                message = 'No support :(';
            }
            else if(/Mac/i.test(navigator.userAgent)) {
                message = 'Press ⌘-' + actionKey + ' to ' + e.action;
            }
            else {
                message = 'Press Ctrl-' + actionKey + ' to ' + e.action;
            }
            brSnackbar.create(message);
        };
        scope.isNullish = (x) => x===null || typeof x === 'undefined';
    }
}

function asJsonIfJson(input, knownJson, $sanitize) {
    if (!knownJson) {
        if (!input) return null;
        let inputTrimmed = input.trim();
        if ((inputTrimmed.startsWith("{") && inputTrimmed.endsWith("}")) || (inputTrimmed.startsWith("[") && inputTrimmed.endsWith("]"))) {
            // looks like json 
            try { input = JSON.parse(inputTrimmed); } catch (okayIfNotJson) { return null; }
        } else {
            return null;
        }
    }
    return $sanitize('<div class="multiline-code">' + _.escape(jsyaml.dump(input)) + '</div>');
}

export function brLinkyFilter($filter, $state, $sanitize) {
    // render links as html, and everything else as not html.
    return function(input, key, target, attributes) {
        if (input == null) {
            return '';
        } else if (!angular.isString(input)) {
            return asJsonIfJson(input, true, $sanitize) || $filter('linky')(angular.toJson(input), target, attributes);
        } else if (angular.isObject(key) && angular.isString(key.name) && (key.name.indexOf('ssh') > -1 || isSensitiveFieldName(key.name))) {
            return input;
        } else if (angular.isObject(key) && key.links && key.links.hasOwnProperty('action:open')) {
            let matches = key.links['action:open'].match(/\#\/v1\/applications\/([^\/]+)\/entities\/([^\/]+)/i);
            return matches !== null ?
                $sanitize('<a href="' + $state.href('main.inspect.summary', {applicationId: matches[1], entityId: matches[2]}) + '">' + input + '</a>') :
                $filter('linky')(input, target, attributes);
        } else {
            return asJsonIfJson(input, false, $sanitize) || $filter('linky')(input, target, attributes);
        }
    }
}

