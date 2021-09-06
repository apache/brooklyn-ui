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
    name: 'mainRoot',
    url: '/?debug&keepCreds&useGet&salt',
    // experimental/test options:
    // * useGet means to make a GET request instead of POST
    // * keepCreds means not to request a 200 on successful logout instead of a 401;
    //   this will prevent the browser from clearing cache 
    template: require('ejs-html!./main.template.html'),
    controller: ['$scope', '$http', '$state', '$stateParams', '$log', '$timeout', mainStateController],
    controllerAs: 'vm'
};
export const promptState = {
    name: 'prompt',
    url: '/prompt?debug',
    params: { prompt: true },
    template: require('ejs-html!./main.template.html'),
    controller: ['$scope', '$http', '$state', '$stateParams', mainStateController],
    controllerAs: 'vm'
};

export function mainStateConfig($stateProvider) {
    $stateProvider.state(promptState).state(mainState);
}

export function mainStateController($scope, $http, $state, $stateParams, $log, $timeout) {
    if (!$scope.state) $scope.state = {};
    if ($stateParams.prompt) $scope.state.status = "prompt";
    if (!$scope.state.status) $scope.state.status = "do-logout";
    
    /* There is a lot of complexity in here to support debug pathways with confirmation, 
     * use of http GET instead of POST, and use of API which returns 200 instead of 401.
     * This is because logging out nicely is quite tricky.
     *   Currently we think we have a good pathway without any of that complexity,
     * so if you haven't set "?debug=true" or other special option in the URL it is
     * mostly disabled and follows the happy path where it just logs out and prompts
     * you to log back in. But the debug stuff is left in, in case we encounter edge cases.
     */
     
    $scope.debug = $stateParams.debug;
    if ($scope.debug) {
        $log.info("Logout page running in debug mode. state=", $state, "state params=", $stateParams);
    }
    if ($stateParams.salt) {
        // specify some salt to ensure links change in dev mode
        $scope.salt = (parseInt($stateParams.salt) || 0);
    }
    
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    function clearLocalCache() {
        let ua = window.navigator.userAgent;
        if (ua.indexOf('MSIE ') >= 0 || ua.indexOf(' Edge/') >= 0 || ua.indexOf(' Trident/') >= 0) {
            document.execCommand('ClearAuthenticationCache', 'false');
        } else if (ua.indexOf('Mozilla') >= 0) {
            // this forces the page cache to be cleared so page will be re-requested (but it doesn't clear basic auth cache)
            $http({
                method: 'GET',
                url: '/',
                headers: {
                    'Authorization': 'Basic ' + btoa("logout:logout")
                }
            });
        }
    }

    function handleError(phase, response, expectAlreadyLoggedOut) {
        if (response && response.status >= 300 && response.status < 400 || response.status == 401) {
            // auth required
            if (expectAlreadyLoggedOut) {
                $scope.state = { status: "logout-confirmed", code: response.status };
            } else {
                $scope.state = { status: "already-logged-out", code: response.status };
            }
        } else if (response && response.status && response.status>0) {
            $log.warn("Server failure "+phase, response);
            $scope.state = { status: "failed", message: "server failure ("+response.status+") "+phase+
                (response.message ? ": "+response.message : ""), code: response.status };
        } else {
            $log.info("Connection failure "+phase, response);
            $scope.state = { status: "failed", message: "connection failure "+phase, code: response.status };
        }
        clearLocalCache();
    }
    
    this.logout = (expectAlreadyLoggedOut) => {
        let useGet = $stateParams.useGet;
        let keepCreds = $stateParams.keepCreds;
        
        $scope.state = { status: "logging-out" };
        let params = {};
        let ourToken = 'logging-out-from-webapp';  // used to ensure the 401 is because we logged out
        if (!keepCreds) params.unauthorize = ourToken;
        //let httpCall = useGet ? $http.get('/v1/logout', { params }) : $http.post('/v1/logout', params);
        //httpCall
        $timeout(()=>
          $http({ url: '/v1/logout', method: useGet ? "GET" : "POST", params })
          .then(response => {
            if ($scope.debug) $log.info("Logout response", response);
            $scope.state = { status: "just-logged-out" };
            clearLocalCache();
            
          }, error => {
            if (error.data && error.data.message == ourToken) {
                if ($scope.debug) $log.info("Logout response 401 - ", error);
                if (expectAlreadyLoggedOut) {
                    $scope.state = { status: "success-after-logout" };
                } else {
                    $scope.state = { status: "just-logged-out" };
                }
                clearLocalCache();
                
            } else {
                handleError(expectAlreadyLoggedOut ? "confirming logout" : "logging out", error, expectAlreadyLoggedOut);
            }
          }), 500 /* delay 500ms so other requests finish loading */);
    }
    
    this.retry = () => this.logout();
    
    this.prompt = () => {
        $scope.state.status = "prompt";
    }
    
    this.confirm = () => {
        clearLocalCache();
        this.logout(true);
    }
    
    if ($scope.state.status == "do-logout") this.logout();
}
