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
import ngAnimate from 'angular-animate';
import ngCookies from 'angular-cookies';
import ngResource from 'angular-resource';

import brCore from 'brooklyn-ui-utils/br-core/br-core';

import brUtilsGeneral from "brooklyn-ui-utils/utils/general";
import brServerStatus from 'brooklyn-ui-utils/server-status/server-status';
import brInterstitialSpinner from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import brooklynModuleLinks from 'brooklyn-ui-utils/module-links/module-links';
import brooklynUserManagement from "brooklyn-ui-utils/user-management/user-management";

import uiRouter from 'angular-ui-router';

import mainState from 'views/main/main.controller.js';

import brandAngularJs from 'brand-angular-js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || false;

angular.module('brooklynBlueprintImporter', [ngAnimate, ngCookies, ngResource, brCore, brServerStatus,
    brInterstitialSpinner, brooklynModuleLinks, brooklynUserManagement, uiRouter, mainState, brUtilsGeneral,
    brandAngularJs])
    .config(['$logProvider', '$compileProvider', appConfig])
    .config(['$urlRouterProvider', routerConfig])
    .run(['$rootScope', '$state', 'brSnackbar', errorHandler])
    .run(['$http', httpConfig]);

function appConfig($logProvider, $compileProvider) {
    $logProvider.debugEnabled(!IS_PRODUCTION);
    $compileProvider.debugInfoEnabled(!IS_PRODUCTION);
}

function routerConfig($urlRouterProvider) {
    $urlRouterProvider.otherwise('/');
}

function errorHandler($rootScope, $state, brSnackbar) {
    $rootScope.$on('$stateChangeError', (event, toState, toParams, fromState, fromParams, error)=> {
        // Add error handling here
    });
}

function httpConfig($http){
    $http.defaults.headers.common['X-Csrf-Token-Required-For-Requests'] = 'write'; //Enables XSRF
    // Add further $http config here
}
