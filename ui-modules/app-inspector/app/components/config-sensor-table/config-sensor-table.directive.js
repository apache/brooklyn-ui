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
import { SENSITIVE_FIELD_REGEX } from "brooklyn-ui-utils/sensitive-field/sensitive-field";

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
            configItemsUnsafeMap: '=',
        },
        link,
    };

    function link(scope) {
        scope.items = [];
        scope.mapInfo = {};
        scope.WARNING_TEXT = 'This value is identified as potentially sensitive based on the name and so it ' +
            'blurred here by default. However it is supplied in the blueprint as plaintext which is not secure. An ' +
            'external provider should be used to store this value with a DSL expression supplied in the blueprint to ' +
            'retrieve the value.';

        scope.$watchGroup(['data','configItemsUnsafeMap'], (changes)=> {
            if (angular.isObject(scope.data)) {
                console.log('scope',scope)
                console.log('scope.configItemsUnsafeMap',scope.configItemsUnsafeMap)
                scope.items = Object.entries(scope.data)
                    .map(([key, value]) => ({
                        key,
                        value,
                        isUnsafe: (scope.configItemsUnsafeMap || {})[key],
                    }));
            }
        });

        scope.$watch('configItemsUnsafeMap', () => {
            console.log('scope.configItemsUnsafeMap 222',scope.configItemsUnsafeMap)
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
    }
}

export function brLinkyFilter($filter, $state, $sanitize) {
    return function(input, key, target, attributes) {
        if (input == null) {
            return '';
        } else if (!angular.isString(input)) {
            return angular.toJson(input);
        } else if (angular.isObject(key) && angular.isString(key.name)
            && (key.name.indexOf('ssh') > -1 || SENSITIVE_FIELD_REGEX.test(key.name))) {
            return input;
        } else if (angular.isObject(key) && key.links && key.links.hasOwnProperty('action:open')) {
            let matches = key.links['action:open'].match(/\#\/v1\/applications\/([^\/]+)\/entities\/([^\/]+)/i);
            return matches !== null ?
                $sanitize('<a href="' + $state.href('main.inspect.summary', {applicationId: matches[1], entityId: matches[2]}) + '">' + input + '</a>') :
                $filter('linky')(input, target, attributes);
        } else {
            return $filter('linky')(input, target, attributes);
        }
    }
}
