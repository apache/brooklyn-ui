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
import template from './stream.template.html';

const MODULE_NAME = 'inspector.stream';

angular.module(MODULE_NAME, [])
    .directive('stream', streamDirective);

export default MODULE_NAME;

export function streamDirective() {
    return {
        template: template,
        restrict: 'E',
        scope: {
            autoUpdate: '=?',
            tail: '=?',
            activityId: '@',
            streamType: '@',
        },
        controller: ['$scope', '$interval', '$element', 'activityApi', controller]
    };

    function controller($scope, $interval, $element, activityApi) {
        $scope.autoUpdate = $scope.autoUpdate !== false;
        $scope.tail = $scope.tail !== false;

        let pre = $element.find('pre');
        let refreshFunction;

        pre.on('mousewheel', () => {
            $scope.$apply(() => {
                $scope.tail = pre[0].scrollTop + pre[0].offsetHeight >= pre[0].scrollHeight;
            });
        });

        $scope.$watch('tail', () => {
            $scope.$applyAsync(() => {
                pre[0].scrollTop = pre[0].scrollHeight;
            });
        });

        $scope.$watch('autoUpdate', ()=> {
            if ($scope.autoUpdate) {
                refreshFunction = $interval(updateStream, 1000);
            } else {
                cancelUpdate();
            }
        });
        $scope.$on('$destroy', cancelUpdate);

        function updateStream() {
            activityApi.activityStream($scope.activityId, $scope.streamType).then((response)=> {
                $scope.stream = response.data;
            }).catch((error)=> {
                if (error.data) {
                    $scope.error = error.data.message;
                }
            }).finally(() => {
                if ($scope.tail) {
                    $scope.$applyAsync(() => {
                        pre[0].scrollTop = pre[0].scrollHeight;
                    });
                }
            })
        }

        function cancelUpdate() {
            if (refreshFunction) {
                $interval.cancel(refreshFunction);
            }
        }

        updateStream();
    }
}

