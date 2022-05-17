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
import brBrandInfo from 'brand-js';
import brooklynUiModulesApi from '../api/brooklyn/ui-modules';
import uibDropdown from 'angular-ui-bootstrap/src/dropdown/index-nocss';
import moduleLinksNavbarTemplate from './module-links-navbar.template.html';
import moduleLinksDrawerTemplate from './module-links-drawer.template.html';

const MODULE_NAME = 'brooklyn.component.module-links';

angular.module(MODULE_NAME, [brBrandInfo, brooklynUiModulesApi, uibDropdown])
    .directive('brooklynModuleLinksMenu', ['$compile', moduleLinksMenuDirective])
    .directive('brooklynModuleLinksDrawer', moduleLinksDrawerDirective);

export function moduleLinksMenuDirective($compile) {
    return {
        restrict: 'A',
        template: moduleLinksNavbarTemplate,
        terminal: true,
        priority: 1000,
        link: link,
        controller: ['brBrandInfo', 'brooklynUiModulesApi', 'brUtilsGeneral', controller],
        controllerAs: 'ctrl'
    };

    function link(scope, element) {
        element
            .attr('uib-dropdown', '')
            .addClass('dropdown')
            .removeAttr('brooklyn-module-links-menu') //remove the attribute to avoid indefinite loop
            .removeAttr('data-brooklyn-module-link-menu'); //also remove the same attribute with data- prefix in case users specify data-common-things in the html

        $compile(element)(scope);
    }

    function controller(brBrandInfo, brooklynUiModulesApi, brUtilsGeneral) {
        this.modules = null;
        this.isModuleActive = (path) => {
            if (path === '/' || path === '') {
                return window.location.pathname === '/';
            } else {
                return window.location.pathname.startsWith(path);
            }
        };

        //Load Modules
        brooklynUiModulesApi.getUiModules().then(response => {
            this.modules = response.sort(brUtilsGeneral.uiModuleComparator)
        });

        this.productName = brBrandInfo.getBrandedText('product.name');
    }
}

export function moduleLinksDrawerDirective() {
    return {
        restrict: 'E',
        template: moduleLinksDrawerTemplate,
        controller: ['$scope', 'brBrandInfo', 'brooklynUiModulesApi', controller]
    };


    function controller($scope, brBrandInfo, brooklynUiModulesApi) {
        $scope.modules = null;
        brooklynUiModulesApi.getUiModules().then(response => {
            $scope.modules = response;
        });
    }
}

export default MODULE_NAME;
