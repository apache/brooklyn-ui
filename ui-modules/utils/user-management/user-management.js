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
import serverApi from '../api/brooklyn/server';
import template from './user-menu.template.html';

const MODULE_NAME = 'brooklyn.component.user-management';

angular.module(MODULE_NAME, [serverApi])
    .directive('brUserMenu', ['$compile', 'serverApi', userMenuDirective]);

export default MODULE_NAME;

export function userMenuDirective($compile, serverApi) {
    return {
        restrict: 'EA',
        template: template,
        terminal: true,
        priority: 1000,
        link: link
    };

    function link(scope, element, attrs, controller) {
        element
            .attr('uib-dropdown', '')
            .addClass('dropdown')
            .removeAttr('br-user-menu') //remove the attribute to avoid indefinite loop
            .removeAttr('data-br-user-menu'); //also remove the same attribute with data- prefix in case users specify data-common-things in the html
        serverApi.getUser().then((response) => {
            scope.user = response.data;
        }).catch((response) => {
            scope.user = 'user';
        });
        $compile(element)(scope);
    }
}
