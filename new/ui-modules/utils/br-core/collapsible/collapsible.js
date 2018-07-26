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
import angularBootstrap from 'angular-ui-bootstrap';
import template from './collapsible.html';

const MODULE_NAME = 'core.collapsible';

/**
 * @ngdoc directive
 * @name brCollapsible
 * @module brCore
 * @restrict E
 *
 * @description
 * HTML block element that displays a collapsible panel,
 * wrapping bootstrap uib-accordion in Brooklyn-preferred styles including:
 * entire header panel clickable, chevrons pointing sensible directions, simpler syntax, colours.
 *
 * @param {string=} [heading]  Text for the heading (attribute or element)
 * @param {boolean=} [state]  Variable specifying whether the panel is expanded
 *
 * @example
 * ### Example using an attribute
 * <example module="br.core" expanding-example-200px="true">
 *     <file name="index.html">
 *         <br-collapsible heading="Heading as Attribute">
 *             Content
 *         </br-collapsible>
 *     </file>
 * </example>
 *
 * @example
 * ### Example using an element to include HTML and state read/write
 * <example module="br.core" expanding-example-200px="true">
 *     <file name="index.html">
 *         <div ng-init="x = { open: true };">
 *           <br-collapsible state="x.open">
 *             <heading>Heading as <b>Element</b> <i>with HTML</i> 
 *               (<a ng-click="x.open = !x.open; $event.stopPropagation();">{{ x.open ? 'opened' : 'closed' }}</a>)</heading>
 *             This panel starts opened. 
 *             It's now <a ng-click="x.open = !x.open;">{{ x.open ? 'opened' : 'closed' }}</a>.
 *           </br-collapsible>
 *           Panel above is <a ng-click="x.open = !x.open;">{{ x.open ? 'opened' : 'closed' }}</a>.
 *         </div>
 *     </file>
 * </example>
 */
angular.module(MODULE_NAME, [angularBootstrap])
    .directive('brCollapsible', brCollapsible);

export default MODULE_NAME;

export function brCollapsible() {
    return {
        restrict: 'E',
        scope: { 'state': '=?', 'heading': '@?' },
        transclude: { 'heading': '?heading' },
        template: template,
        link: function($scope) {
            // hideous but almost perfect way to suppress the ugly focus on click but not on keypress
            // it flashes blur for a short while on click is all
            // cf http://stackoverflow.com/questions/19053181/how-to-remove-focus-around-buttons-on-click
            function stopPropagationIfInHeader($event, target, endpoint) {
                var targets = [];
                while (target.length && target !== endpoint) {
                    targets.push(target[0]);
                    if (target.hasClass("panel-title")) {
                        // blur everything contained in us if the click was in the title
                        for (let ti in targets) { targets[ti].blur(); }
                        // these don't work to suppress focussing:
                        // $event.stopPropagation();
                        // $event.preventDefault();
                        return;
                    }
                    target = target.parent(); 
                }
            };
            $scope.stopPropagationIfFromHeader = function($event) {
                if (/MouseEvent/.test($event.toString())) {
                    stopPropagationIfInHeader($event, angular.element($event.target), angular.element($event.currentTarget));
                }
            };

            $scope.stateWrapped = { state: false };
            if (typeof $scope.state != 'undefined') {
                // Bi-di watching and wrapping required due to how underlying widget works
                // See https://github.com/angular-ui/bootstrap/issues/4656
                $scope.stateWrapped.state = $scope.state;
                $scope.$watch('stateWrapped.state', function(newStateWrapped) { $scope.state = newStateWrapped; });
                $scope.$watch('state', function(newState) { $scope.stateWrapped.state = newState; });
            }
        }
    };
}
