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
import template from './not-ready-appliance.template.html';

const MODULE_NAME = 'brooklyn.composer.component.not-ready-appliance';
const TEMPLATE_URL = 'blueprint-composer/component/not-ready-appliance/index.html';

angular.module(MODULE_NAME, [])
    .directive('notReadyAppliance', notReadyApplianceDirective)
    .run(['$templateCache', templateCache]);

export default MODULE_NAME;

export function notReadyApplianceDirective() {

    return {
        restrict: 'E',
        templateUrl: function (tElement, tAttrs) {
            return tAttrs.templateUrl || TEMPLATE_URL;
        },
        link: link
    };
}

function link($scope) {
    $scope.warningIconClicked = false;

    $scope.$on('destroy', () => {
        angular.element(window).off('click', toto);
    });

    let onClickWindow = (event) => {
        let quickInfo = document.getElementsByClassName('iconInfoWidget').item(0);
        if ($scope.warningIconClicked && quickInfo
            && !quickInfo.contains(event.target) && !event.target.classList.contains("node-warning")) {
            $scope.warningIconClicked = false;
            $scope.$apply();
        }
    }

    let closePopover = (event) => {
        $scope.warningIconClicked = false;
        $scope.$apply();
    }

    $scope.$on('scroll-svg', closePopover);
    $scope.$on('dragstart-svg', closePopover);
    angular.element(window).on('click', onClickWindow);
    angular.element(window).on('scroll', closePopover);
    angular.element(window).on('dragstart', closePopover);

    $scope.$on("iconInfoInteractiveAppliance", function(event, x,y, applianceName, warningMessage) {
        $scope.position = {top: y + "px", left: x + "px", position: "fixed"};
        $scope.warningIconClicked = true;
        $scope.warningMessage = "This appliance has an interactive profile. Please edit it.";
        $scope.applianceName = applianceName;
    });

    $scope.$on("iconInfoNoOsProfile", function(event, x,y, applianceName, warningMessage) {
        $scope.position = {top: y + "px", left: x + "px", position: "fixed"};
        $scope.warningIconClicked = true;
        $scope.warningMessage = "This appliance has no OS profile. Please edit it.";
        $scope.applianceName = applianceName;
    });
}

function templateCache($templateCache) {
    $templateCache.put(TEMPLATE_URL, template);
}