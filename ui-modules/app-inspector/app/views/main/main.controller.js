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
    controller: ['$scope', '$q', 'brWebNotifications', mainController],
    controllerAs: 'ctrl'
};

export function mainController($scope, $q, brWebNotifications) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    let ctrl = this;

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
