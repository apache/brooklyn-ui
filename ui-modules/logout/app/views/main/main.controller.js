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
    controller: ['$scope', '$http', mainStateController],
    controllerAs: 'vm'
};

export function mainStateConfig($stateProvider) {
    $stateProvider.state(mainState);
}

export function mainStateController($scope, $http) {
    $scope.state = { status: "checking", message: "Preparing to log out" };
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    function clearLocalCache() {
        let ua = window.navigator.userAgent;
        if (ua.indexOf('MSIE ') >= 0 || ua.indexOf(' Edge/') >= 0 || ua.indexOf(' Trident/') >= 0) {
            document.execCommand('ClearAuthenticationCache', 'false');
        }
    }

    function handleError(phase, response) {
        if (response && response.status >= 300 && response.status < 500) {
            // auth required
            $scope.state = { status: "already-logged-out" };
        } else if (response && response.status && response.status>0) {
            console.log("Server failure "+phase, response);
            $scope.state = { status: "failed", message: "server failure ("+response.status+") "+phase+
                (response.message ? ": "+response.message : "") };
        } else {
            console.log("Connection failure "+phase, response);
            $scope.state = { status: "failed", message: "connection failure "+phase };
        }
        clearLocalCache();
    }
        
    function getUserThen(f) {
        $http.get('v1/server/user').then(response => {
            console.log("User check response", response);
            $scope.state = { status: "logging-out", user: response.data };
            f(response.data);
            clearLocalCache();
            
        }, error => {
            handleError("processing logged-on user check", error);
        });
    }
    
    function postLogout(user) {
        console.log("posting to "+'v1/logout/'+user);
        $http.post('v1/logout'+(user ? '/'+user : '')).then(response => {
            console.log("Logout response", response);
            $scope.state = { status: "just-logged-out" };
            clearLocalCache();
            
        }, error => {
            handleError("logging out", error);
        });
    }
    
    $scope.logout = () => getUserThen(postLogout);
    $scope.logout();
    
    return;
    
    let userRequest = new XMLHttpRequest();
    userRequest.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            logout(this.responseText)
        }
    };
    userRequest.open('GET', '/v1/server/user', true);
    userRequest.send('');

    
    function logout2(user) {
        
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
