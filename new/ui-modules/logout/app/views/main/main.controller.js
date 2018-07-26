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
import uiRouter from 'angular-ui-router';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';

const MODULE_NAME = 'main.state';

angular.module(MODULE_NAME, [uiRouter])
    .config(['$stateProvider', mainStateConfig]);

export default MODULE_NAME;

export const mainState = {
    name: 'main',
    url: '/',
    template: require('ejs-html!./main.template.html'),
    controller: ['$scope', mainStateController],
    controllerAs: 'vm'
};

export function mainStateConfig($stateProvider) {
    $stateProvider.state(mainState);
}

export function mainStateController($scope) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    let userRequest = new XMLHttpRequest();
    userRequest.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            logout(this.responseText)
        }
    };
    userRequest.open('GET', '/v1/server/user', true);
    userRequest.send('');

    /**
     * Logout the supplied user
     * @param user
     */
    function logout(user) {
        let ua = window.navigator.userAgent;
        if (ua.indexOf('MSIE ') >= 0 || ua.indexOf(' Edge/') >= 0 || ua.indexOf(' Trident/') >= 0) {
            document.execCommand('ClearAuthenticationCache', 'false');
        }
        let logoutRequest = new XMLHttpRequest();
        logoutRequest.onreadystatechange = function () {
            if (this.readyState === 4) {
                if (this.status === 401) {
                    console.info('User ' + user + ' logged out')
                } else {
                    setTimeout(function () {
                        logout(user);
                    }, 1000);
                }
            }
        };
        logoutRequest.open('POST', '/v1/logout', true, user, Math.random().toString(36).slice(2));
        logoutRequest.send('');
    }
}
