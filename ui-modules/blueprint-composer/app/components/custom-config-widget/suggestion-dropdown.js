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
import template from './suggestion-dropdown.html';

const MODULE_NAME = 'brooklyn.components.custom-config-widget.suggestion-dropdown';
const TEMPLATE_URL = 'blueprint-composer/component/suggestion-dropdown/index.html';

angular.module(MODULE_NAME, [])
    .directive('suggestionDropdown', ['$rootScope', suggestionDropdownDirective])
    .run(['$templateCache', templateCache]);

export default MODULE_NAME;

export function suggestionDropdownDirective($rootScope) {
    return {
        require: "^^specEditor",  // only intended for use in spec editor, and calls functions on that controller
        restrict: 'E',
        templateUrl: function (tElement, tAttrs) {
            return tAttrs.templateUrl || TEMPLATE_URL;
        },
        scope: {
            item: '=',
            params: '=',
            config: '=',
            model: '=',
        },
        link: link,
    };

    function link(scope, element, attrs, specEditor) {
        try {
            scope.specEditor = specEditor;
            scope.defined = specEditor.defined;
            scope.getSuggestions = () => {
                var result = [];
                if (scope.params['suggestion-values']) {
                    scope.params['suggestion-values'].forEach( (v) => {
                        if (v["value"]) {
                            result.push(v);
                        } else {
                            result.push({value: v});
                        }
                    });
                    return result;
                }
            };
        } catch (e) {
            if ($scope.params) {
                $scope.params.error = e;
            }
            throw e;
        }
    }
}

function templateCache($templateCache) {
    $templateCache.put(TEMPLATE_URL, template);
}