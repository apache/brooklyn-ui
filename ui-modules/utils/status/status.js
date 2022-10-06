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
import template from './status.template.html';

const ICONS = {
    CREATED: 'CREATED',
    STARTING: 'STARTING',
    RUNNING: 'RUNNING',
    STOPPING: 'STOPPING',
    STOPPED: 'STOPPED',
    ON_FIRE: 'ON_FIRE',
    ERROR: 'ERROR',
    UNKNOWN: 'UNKNOWN',
    NO_STATE: 'NO_STATE'
};

const STATUS = {
    CREATED: {name: 'Created', icon: ICONS.CREATED},
    STARTING: {name: 'Starting', icon: ICONS.STARTING},
    RUNNING: {name: 'Running', icon: ICONS.RUNNING},
    STOPPING: {name: 'Stopping', icon: ICONS.STOPPING},
    STOPPED: {name: 'Stopped', icon: ICONS.STOPPED},
    ON_FIRE: {name: 'On fire', icon: ICONS.ON_FIRE},
    ERROR: {name: 'Error', icon: ICONS.ERROR},
    UNKNOWN: {name: 'Unknown', icon: ICONS.UNKNOWN},
    NO_STATE: {name: '', icon: ICONS.NO_STATE},

    // for tasks
    'In progress': {name: 'In progress', icon: ICONS.STARTING},
    'Completed': {name: 'Completed', icon: ICONS.RUNNING},
    'Failed': {name: 'Failed', icon: ICONS.ERROR},
    'Unavailable': {name: 'Incomplete', icon: ICONS.ERROR},
    'Cancelled': {name: 'Cancelled', icon: ICONS.ERROR},
};

const MODULE_NAME = 'brooklyn.components.status';

angular.module(MODULE_NAME, [])
    .directive('brooklynStatus', statusDirective)
    .directive('brooklynStatusIcon', statusIconDirective)
    .directive('brooklynStatusText', statusTextDirective);

export default MODULE_NAME;

export function statusDirective() {
    var directive = {
        template: '<brooklyn-status-icon value="{{value}}"></brooklyn-status-icon><brooklyn-status-text value="{{value}}"></brooklyn-status-text>',
        restrict: 'E',
        scope: {
            value: '@'
        }
    };
    return directive;
}
export function statusIconDirective() {
    var directive = {
        template: template,
        restrict: 'E',
        scope: {
            value: '@'
        },
        link: link
    };
    return directive;
}
export function statusTextDirective() {
    var directive = {
        template: '<div ng-class="statusClass()">{{status.name || value}}</div>',
        restrict: 'E',
        scope: {
            value: '@'
        },
        link: link
    };
    return directive;
}


function link($scope) {
    $scope.status = STATUS.NO_STATE;
    $scope.$watch('value', (nevVal)=> {
        $scope.status = (STATUS.hasOwnProperty($scope.value)) ? STATUS[$scope.value] : STATUS.NO_STATE;
    });
    $scope.statusClass = function () {
        return 'status-' + $scope.status.icon.toLowerCase();
    }
}
