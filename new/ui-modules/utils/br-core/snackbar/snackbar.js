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
import angularAnimate from 'angular-animate';
import template from './snackbar.html';

const MODULE_NAME = 'core.snackbar';
const TEMPLATE_URL = 'templates/snackbar.html';

/**
 * @ngdoc service
 * @name brSnackbar
 * @module brCore
 *
 * @description
 * The brSnackbar service expose a simple method to create snackbars within your apps. This service make use of the
 * `$animate` service by default
 *
 * @example
 * ### Simple snackbar examples
 * <example module="mySnackbar">
 *     <file name="index.html">
 *         <div ng-controller="myController" style="height: 500px">
 *             <br-button on-click="createSnackBar('This is my small snackbar')">Small snackbar</br-button>
 *             <br-button on-click="createSnackBar('This is my veeeeeery long snackbar with a lorem ipsum text: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec dui ex, iaculis in arcu in, placerat iaculis dui. Vivamus interdum nisl non dignissim pulvinar.')">Looooooong snackbar</br-button>
 *         </div>
 *     </file>
 *     <file name="app.js">
 *         angular.module('mySnackbar', ['br.core'])
 *             .controller('myController', function($scope, brSnackbar) {
 *                 $scope.createSnackBar = function(message) {
 *                     brSnackbar.create(message);
 *                 }
 *             });
 *     </file>
 * </example>
 *
 * @example
 * ### Snackbar example with callback
 * <example module="mySnackbar">
 *     <file name="index.html">
 *         <div ng-controller="myController" style="height: 500px">
 *             <br-button on-click="createSnackBar('This is my snackbar with a callback')">Snackbar with callback</br-button>
 *             <div class="callbacks"></div>
 *         </div>
 *     </file>
 *     <file name="app.js">
 *         angular.module('mySnackbar', ['br.core'])
 *             .controller('myController', function($scope, brSnackbar) {
 *                 var callbacks = angular.element(document.querySelector('.callbacks'));
 *                 $scope.createSnackBar = function(message) {
 *                     brSnackbar.create(message).then(function($element) {
 *                         callbacks.append('<p>Closed snackback with message: ' + angular.element($element[0].querySelector('.snackbar-message')).html() + '</p>');
 *                     });
 *                 }
 *             });
 *     </file>
 * </example>
 *
 * @example
 * ### Snackbar examples with action
 * <example module="mySnackbar">
 *     <file name="index.html">
 *         <div ng-controller="myController" style="height: 500px">
 *             <br-button on-click="createSnackBar('This is my snackbar with an UNDO action', {label: 'undo', callback: callback})">Snackbar with UNDO action</br-button>
 *             <br-button on-click="createSnackBar('This is my snackbar with another action', {label: 'Do that', callback: callback})">Snackbar with DO THAT action</br-button>
 *             <div class="callbacks"></div>
 *         </div>
 *     </file>
 *     <file name="app.js">
 *         angular.module('mySnackbar', ['br.core'])
 *             .controller('myController', function($scope, brSnackbar) {
 *                 var callbacks = angular.element(document.querySelector('.callbacks'));
 *                 $scope.createSnackBar = function(message, action) {
 *                     brSnackbar.create(message, action);
 *                 }
 *
 *                 $scope.callback = function($element) {
 *                     callbacks.append('<p>Clicked on action: ' + angular.element($element[0].querySelector('.snackbar-action')).html() + '</p>');
 *                 }
 *             });
 *     </file>
 * </example>
 */

angular.module(MODULE_NAME, [angularAnimate])
    .factory('brSnackbar', ['$rootScope', '$document', '$compile', '$templateCache', '$animate', '$timeout', '$q', brSnackbar])
    .run(['$templateCache', snackbarRun]);

export default MODULE_NAME;

export function brSnackbar($rootScope, $document, $compile, $templateCache, $animate, $timeout, $q) {
    $rootScope.snackbars = [];

    $rootScope.$watchCollection('snackbars', function(newSnackbars, oldSnackbars) {
        if (newSnackbars.length > oldSnackbars.length) {
            // We added a snackbar
            if (newSnackbars.length === 1) {
                // That is the first one, let's display it
                displaySnackbar(newSnackbars[0]);
            }
        } else {
            // One snackbar down, check if there are still some to display
            if (newSnackbars.length > 0) {
                displaySnackbar(newSnackbars[0]);
            }
        }
    });

    function displaySnackbar(snackbar) {
        // Add the snackbar to the dom
        $animate.enter(snackbar.elm, $document.find('body'));

        // Remove the snackbar after the timeout
        snackbar.timeout = $timeout(function() {
            removeSnackbar(snackbar);
        }, 5000);
    }

    function removeSnackbar(snackbar) {
        $animate.leave(snackbar.elm).then(function() {
            snackbar.promise.resolve(snackbar.elm);
            $rootScope.snackbars.shift();
        });
    }

    return {
        /**
         * @ngdoc method
         * @name brSnackbar#create
         *
         * @description
         * Create a snackbar that will be display on the bottom left of the screen. When you create a new snackbar, it will return
         * a promise that will be resolve once this snackbar is dismissed. You can also add one action button that will trigger
         * a callback.
         *
         * The snackbars are not stacked but displayed one after the other, as per as the [material design guidelines](https://www.google.com/design/spec/components/snackbars-toasts.html#snackbars-toasts-usage)
         *
         * @param {string} message The snackbar message
         * @param {object} action An object containing the action `label` and `callback`. The callback function will take
         * the current `$element` object of the snackbar
         * @returns {promise} A promise that will be resolved once the snackbar is dismissed
         */
        create: function(message, action) {
            var scope = $rootScope.$new(true);
            scope.message = message;
            scope.action = angular.extend({}, action);
            scope.hasAction = function() {
                return !angular.isUndefined(scope.action.label) && !angular.isUndefined(scope.action.callback);
            };
            scope.performAction = function() {
                var snackbar = $rootScope.snackbars[0];
                scope.action.callback(snackbar.elm);
                $timeout.cancel(snackbar.timeout);
                removeSnackbar(snackbar);
            };

            var template = $templateCache.get(TEMPLATE_URL);
            var elm = angular.element($compile(template)(scope));
            var promise = $q.defer();

            $rootScope.snackbars.push({
                elm: elm,
                promise: promise
            });

            return promise.promise;
        }
    };
}

export function snackbarRun($templateCache) {
    $templateCache.put(TEMPLATE_URL, template);
}
