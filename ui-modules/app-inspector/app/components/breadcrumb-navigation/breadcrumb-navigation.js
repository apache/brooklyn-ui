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
import template from "./breadcrumb-navigation.html";

const MODULE_NAME = 'inspector.breadcrumb';

angular.module(MODULE_NAME, [])
    .directive('breadcrumbNavigation', ['$compile', 'activityApi', breadcrumbNavigation]);

export default MODULE_NAME;

export function breadcrumbNavigation($compile, activityApi) {
    return {
        restrict: 'A',
        template: template,
        scope: {
            entityId: "@",
            parentId: "@"
        },
        link: link
    };

    function link($scope, $element) {
        if ($scope.parentId) {
            $scope.breadcrumb = {
                loading: true,
                entityId: $scope.entityId,
                parentId: $scope.parentId
            };

            activityApi.activity($scope.parentId).then((response)=> {
                $scope.breadcrumb.parentName = response.data.displayName;
                if (response.data.submittedByTask) {
                    $scope.breadcrumb.id = response.data.submittedByTask.metadata.id;
                    let el = $compile('<li breadcrumb-navigation parent-id="{{breadcrumb.id}}" entity-id="{{breadcrumb.entityId}}"></li>')($scope);
                    $element.parent().prepend(el);
                }
                $scope.breadcrumb.loading = false;
            });
        }
    }
}

