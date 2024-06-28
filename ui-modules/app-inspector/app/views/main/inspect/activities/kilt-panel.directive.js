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
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from './kilt-panel.template.html';
import modalTemplate from './kilt.modal.template.html';
import {STORAGE_KEY_COLOR_MODE} from "../../../../components/task-sunburst/task-sunburst.directive";

const MODULE_NAME = 'activities.kilt-panel';

angular.module(MODULE_NAME, [])
    .directive('activitiesListAndKiltPanel', activitiesListAndKiltPanelDirective)

export default MODULE_NAME;


export function activitiesListAndKiltPanelDirective() {
    return {
        template: template,
        restrict: 'E',
        transclude: true,
        scope: {
            activities: '=',
            focusedActivities: '=',
            globalFilters: '=',
        },
        controller: ['$scope', '$window', '$state', '$stateParams', '$log', '$timeout', 'brUtilsGeneral', controller],
        controllerAs: 'vm'
    };

    function controller($scope, $window, $state, $stateParams, $log, $timeout, Utils) {
        $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
        let vm = this;
        vm.isNonEmpty = Utils.isNonEmpty;
        vm.modalTemplate = modalTemplate;

        vm.wideKilt = false;
        vm.setWideKilt = function (newValue) {
            vm.wideKilt = newValue;
        };

        vm.simpleColors = window.localStorage.getItem(STORAGE_KEY_COLOR_MODE)=='simple';
        vm.toggleColorScheme = function () {
            vm.simpleColors = !vm.simpleColors;
            $window.localStorage.setItem(STORAGE_KEY_COLOR_MODE, vm.simpleColors ? 'simple' : 'normal');
            $timeout(function () {
                $scope.$broadcast('changedKiltColorScheme')
            }, 0);
        };
    }

}