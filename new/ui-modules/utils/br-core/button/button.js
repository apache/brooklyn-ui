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
import template from './button.html';

const MODULE_NAME = 'core.button';

/**
 * @ngdoc directive
 * @name brButton
 * @module brCore
 * @scope
 * @restrict E
 *
 * @description
 * HTML button element The data-binding and validation properties of this element are exactly the same as those of the
 * button element.
 *
 * @callback callback
 * @param {string=} ngModel Assignable angular expression to data-bind to.
 * @param {string=} type Type of the button which is effectively a CSS class name. For more info, see: http://getbootstrap.com/css/#buttons-options
 * @param {string=} link The link where this button should link to. If not specified or empty, it won't do anything.
 * @param {callback=} on-click The callback function calls when the button is clicked.
 *
 * @example
 * ### Default button
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-button>Default button</br-button>
 *     </file>
 * </example>
 *
 * @example
 * ### Default button that links to http://google.com
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-button link="http://google.com">Default button with link</br-button>
 *     </file>
 * </example>
 *
 * @example
 * ### Default button that with a on-click callback
 * <example module="myButton">
 *     <file name="index.html">
 *         <div ng-controller="myController">
 *             <br-button on-click="handleClick('Button was clicked!')">Default button with callback</br-button>
 *         </div>
 *     </file>
 *     <file name="script.js">
 *         angular.module('myButton', ['br.core'])
 *             .controller('myController', function($scope, $element) {
 *                 $scope.handleClick = function(message) {
 *                     $element.append(message);
 *                 }
 *             });
 *     </file>
 * </example>
 *
 * @example
 * ### Primary button
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-button type="btn-primary">Primary button</br-button>
 *     </file>
 * </example>
 *
 * @example
 * ### Accent color button
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-button type="btn-accent">Accent color button</br-button>
 *     </file>
 * </example>
 *
 * @example
 * ### Success button
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-button type="btn-success">Success button</br-button>
 *     </file>
 * </example>
 *
 * @example
 * ### Info button
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-button type="btn-info">Info button</br-button>
 *     </file>
 * </example>
 *
 * @example
 * ### Warning button
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-button type="btn-warning">Warning button</br-button>
 *     </file>
 * </example>
 *
 * @example
 * ### Danger button
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-button type="btn-danger">Danger button</br-button>
 *     </file>
 * </example>
 */
angular.module(MODULE_NAME, [angularBootstrap])
    .directive('brButton', brButton);

export default MODULE_NAME;

export function brButton() {
    return {
        restrict: 'E',
        scope: {
            type: '@',
            link: '@',
            click: '&onClick'
        },
        transclude: true,
        template: template,
        replace: true
    };
}
