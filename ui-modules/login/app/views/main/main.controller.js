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
import serverApi from 'brooklyn-ui-utils/api/brooklyn/server.js';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from "./main.template.html";
// import {loginState, loginStateConfig} from "../login/login.controller";

const MODULE_NAME = 'states.login';

angular.module(MODULE_NAME, [uiRouter, serverApi])
    .config(['$stateProvider', loginStateConfig]);

export default MODULE_NAME;

export const loginState = {
    name: 'login',
    url: '/',
    template: template,
    controller: ['$scope', '$http', '$window', 'brBrandInfo', loginStateController],
    controllerAs: 'vm',
    resolve: {}
};

export function loginStateConfig($stateProvider) {
    $stateProvider.state(loginState);
}

export function loginStateController($scope, $http, $window, brBrandInfo) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    $scope.getBrandedText = brBrandInfo.getBrandedText;

    $scope.login = (user)=> {
        var req = {
            method: 'GET',
            url: '/',
            headers: {
                'Authorization': 'Basic ' + btoa(user.name +":" + user.password)
            }
        }
// ui registry metadata
        $http(req)
            .then(function () {
                $window.location.href = '/';
            });
    };
}
