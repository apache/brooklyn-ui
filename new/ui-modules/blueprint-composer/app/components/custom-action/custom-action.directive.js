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

const MODULE_NAME = 'brooklyn.components.custom-action';

angular.module(MODULE_NAME, [])
    .directive('customAction', ['$compile', customActionDirective]);

export default MODULE_NAME;

export function customActionDirective($compile) {
    return {
        restrict: 'E',
        scope: {
            action: '=action'
        },
        link: link
    };

    function link(scope, element) {
        let actionScope = scope.$parent;
        if (scope.action.ctx) {
            actionScope = scope.$new();
            actionScope.ctx = scope.action.ctx;
        }
        element.append($compile(scope.action.html)(actionScope));
    }
}