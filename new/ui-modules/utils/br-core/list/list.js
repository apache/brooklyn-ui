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
import template from './list.html';

const MODULE_NAME = 'core.list';
/**
 * @ngdoc directive
 * @name brList
 * @module brCore
 * @restrict E
 *
 * @description
 * HTML block element that wraps a list of items.
 *
 * @example
 * ### Basic list
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-list>
 *             <li>Item #1</li>
 *             <li>Item #2</li>
 *             <li>Item #3</li>
 *         </br-list>
 *     </file>
 * </example>
 *
 * @example
 * ### List with data coming from angular
 * <example module="myList">
 *     <file name="index.html">
 *         <div ng-controller="myListController">
 *             <br-list>
 *                 <li ng-repeat="item in items">{{item}}</li>
 *             </br-list>
 *         </div>
 *     </file>
 *     <file name="script.js">
 *          angular.module('myList', ['br.core'])
 *              .controller('myListController', ['$scope', function($scope) {
 *                  $scope.items = [
 *                      'item #1',
 *                      'item #2',
 *                      'item #3',
 *                      'item #4'
 *                  ];
 *              }]);
 *     </file>
 * </example>
 */
angular.module(MODULE_NAME, [angularBootstrap])
    .directive('brList', brList);

export default MODULE_NAME;

export function brList() {
    return {
        restrict: 'E',
        transclude: true,
        template: template,
        replace: true
    };
}
