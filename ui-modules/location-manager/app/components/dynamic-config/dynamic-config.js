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
import locationUtils from '../location-utils/location-utils';
import dynamicConfigTemplate from './dynamic-config.html';

const MODULE_NAME = 'brooklyn.components.dynamic-config';

angular.module(MODULE_NAME, [locationUtils])
    .directive('dynamicConfig', dynamicConfigDirective);

export default MODULE_NAME;

export function dynamicConfigDirective() {
    return {
        restrict: 'E',
        template: dynamicConfigTemplate,
        scope: {
            model: '=',
            type: '@'
        },
        controller: ['$scope', '$timeout', 'locationConfig', controller]
    };

    function controller($scope, $timeout, locationConfig) {
        $scope.showDynamicConfigForm = false;
        $scope.locationConfig = locationConfig;
        $scope.suggestions = Object.keys(locationConfig).map(function (key) {
            return {
                name: key,
                description: locationConfig[key].description
            };
        });

        $scope.toggleDynamicConfigForm = function () {
            $scope.showDynamicConfigForm = !$scope.showDynamicConfigForm;
            $timeout(function () {
                $scope.newDynamicKey = '';
                $scope.dynamicConfigForm.$setPristine();
                $scope.dynamicConfigForm.$setUntouched();
            });
        };

        $scope.onSubmitDynamicConfigForm = function () {
            if ($scope.newDynamicKey) {
                $scope.model[$scope.newDynamicKey] = locationConfig[$scope.newDynamicKey] && locationConfig[$scope.newDynamicKey].type === 'checkbox' ? false : '';
                $scope.newDynamicKey = '';
                $scope.showDynamicConfigForm = false;
            }
        };

        $scope.onDeleteDynamicConfig = function (key) {
            if ($scope.model.hasOwnProperty(key)) {
                delete $scope.model[key];
            }
        };
    }
}
