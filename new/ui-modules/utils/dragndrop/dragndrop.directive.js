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
/**
 * A directive for drag and drop events in AngularJS
 *
 * Adapted from the AngularJS source code that creates the ng-event directives, see:
 * https://github.com/angular/angular.js/blob/master/src/ng/directive/ngEventDirs.js
 *
 * Same idea at https://stackoverflow.com/a/38753647
 */

import angular from "angular";

let dndDirectives = {};

angular.forEach(
    'drag dragend dragenter dragexit dragleave dragover dragstart drop'.split(' '),
    function(eventName) {
        let directiveName = 'ng' + eventName.charAt(0).toUpperCase() + eventName.slice(1);

        dndDirectives[directiveName] = ['$parse', '$rootScope', function($parse, $rootScope) {
            return {
                restrict: 'A',
                compile: function($element, attr) {
                    let fn = $parse(attr[directiveName], null, true);

                    return function ngDragEventHandler(scope, element) {
                        element.on(eventName, function(event) {
                            var callback = function() {
                                fn(scope, {$event: event});
                            };

                            scope.$apply(callback);
                        });
                    };
                }
            };
        }];
    }
);

const MODULE_NAME = 'brooklyn.ui.dragndrop';
angular.module(MODULE_NAME, [])
    .directive(dndDirectives);

export default MODULE_NAME;
