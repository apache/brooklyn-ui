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
import template from "./entity-policy.template.html";
import brAutoFocus from 'brooklyn-ui-utils/autofocus/autofocus';

const MODULE_NAME = 'inspector.entity.policy';

angular.module(MODULE_NAME, [brAutoFocus])
    .directive('entityPolicy', entityPolicyDirective)
    .directive('disabledSubmitOnEnter', disabledSubmitOnEnter);

export default MODULE_NAME;

export function entityPolicyDirective() {
    return {
        restrict: 'E',
        template: template,
        scope: {
            policy: '<',
            applicationId: '@',
            entityId: '@'
        },
        controller: ['$scope', '$http', '$filter', '$state', 'entityApi', 'brSnackbar', controller]
    };

    function controller($scope, $http, $filter, $state, entityApi, brSnackbar) {
        $scope.searchCriteria = '';
        $scope.reverse = false;
        $scope.error = undefined;

        let observers = [];

        entityApi.entityAdjunctConfigInfo($scope.applicationId, $scope.entityId, $scope.policy.id).then((response)=> {
            $scope.info = response.data;

            $scope.info.forEach((config)=> {
                entityApi.entityAdjunctConfigValue($scope.applicationId, $scope.entityId, $scope.policy.id, config.name).then((response)=> {
                    config.value = response.data;
                    config.newValue = response.data;
                    $scope.error = undefined;
                    observers.push(response.subscribe((response)=> {
                        config.value = response.data;
                        config.newValue = response.data;
                        $scope.error = undefined;
                    }));
                }).catch((error)=> {
                    $scope.error = 'Cannot load configuration value for policy with ID: ' + $scope.policy.id;
                });
            });
        }).catch((error)=> {
            $scope.error = 'Cannot load configuration information for policy with ID: ' + $scope.policy.id;
        });

        $scope.updateAdjunctConfig = function (config, $data) {
            entityApi.updateEntityAdjunctConfig($scope.applicationId, $scope.entityId, $scope.policy.id, config.name, JSON.stringify($data)).then((response)=> {
                brSnackbar.create('Configuration updated successfully');
                return true;
            }).catch((response)=> {
                brSnackbar.create(response.data.message);
                return ' ';
            });
        };

        $scope.$on('$destroy', ()=> {
            observers.forEach((observer)=> {
                observer.unsubscribe();
            });
        });
    }
}

export function disabledSubmitOnEnter() {
    return {
        restrict: 'A',
        link: link
    };

    function link(scope, elm) {
        elm.on('keydown', event => {
            if (event.keyCode === 13) {
                event.stopPropagation();
                event.preventDefault();
            }
        });
    }

}
