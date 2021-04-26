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
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from "./main.template.html";

export const mainState = {
    name: 'main',
    url: '/',
    template: template,
    controller: ['$scope', '$q', 'brWebNotifications', 'brBrandInfo', mainController],
    controllerAs: 'ctrl'
};

// Entity relationship constants
export const RELATIONSHIP_HOST_FOR = 'host_for';
export const RELATIONSHIP_HOSTED_ON = 'hosted_on';

// View mode constants
export const RELATIONSHIP_VIEW_DELIMITER = '/';
export const VIEW_PARENT_CHILD = 'parent/child';
export const VIEW_HOST_FOR_HOSTED_ON = RELATIONSHIP_HOST_FOR + RELATIONSHIP_VIEW_DELIMITER + RELATIONSHIP_HOSTED_ON;

const savedSortReverse = 'app-inspector-sort-reverse';

export function mainController($scope, $q, brWebNotifications, brBrandInfo) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    let ctrl = this;

    ctrl.composerUrl = brBrandInfo.blueprintComposerBaseUrl;

    // TODO SMART-143
    ctrl.viewMode = VIEW_PARENT_CHILD;
    ctrl.viewModes = new Set([VIEW_PARENT_CHILD]);
    ctrl.viewModesArray = () => Array.from(ctrl.viewModes); // Array from set for ng-repeat component

    // TODO SMART-143
    $scope.$watch('ctrl.viewModes', () => {
        if (!ctrl.viewModes.has(ctrl.viewMode)) {
            ctrl.viewMode = VIEW_PARENT_CHILD; // Default to 'parent/child' view if current is not available anymore.
        }
    });

    ctrl.sortReverse = localStorage && localStorage.getItem(savedSortReverse) !== null ?
        JSON.parse(localStorage.getItem(savedSortReverse)) :
        true;
    brWebNotifications.supported.then(() => {
        ctrl.isNotificationsSupported = true;
    }).catch(() => {
        ctrl.isNotificationsSupported = false;
    });

    brWebNotifications.isEnabled().then(() => {
        ctrl.isNotificationsEnabled = true;
    }).catch(() => {
        ctrl.isNotificationsEnabled = false;
    });

    brWebNotifications.getPermission().then(permission => {
        ctrl.isNotificationsBlocked = permission === 'denied';
    });

    ctrl.toggleSortOrder = () => {
        ctrl.sortReverse = !ctrl.sortReverse;
        if (localStorage) {
            try {
                localStorage.setItem(savedSortReverse, JSON.stringify(ctrl.sortReverse));
            } catch (ex) {
                $log.error('Cannot save app sort preferences: ' + ex.message);
            }
        }
    }

    ctrl.toggleNotifications = () => {
        brWebNotifications.isEnabled().then(() => {
            return brWebNotifications.setEnable(false);
        }).then(enable => {
            ctrl.isNotificationsEnabled = enable;
        }).catch(() => {
            brWebNotifications.requestPermission().then(permission => {
                ctrl.isNotificationsBlocked = permission === 'denied';

                if (ctrl.isNotificationsBlocked) {
                    return $q.reject();
                }
                return brWebNotifications.setEnable(permission === 'granted');
            }).then(enable => {
                ctrl.isNotificationsEnabled = enable;
            });
        });
    };
}
