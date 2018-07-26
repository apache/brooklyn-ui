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
import uiRouter from 'angular-ui-router';

import brCore from 'brooklyn-ui-utils/br-core/br-core';

import brServerStatus from 'brooklyn-ui-utils/server-status/server-status';
import brAutoFocus from 'brooklyn-ui-utils/autofocus/autofocus';
import brInterstitialSpinner from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import brooklynModuleLinks from 'brooklyn-ui-utils/module-links/module-links';
import brSensitiveField from 'brooklyn-ui-utils/sensitive-field/sensitive-field';
import brooklynUserManagement from 'brooklyn-ui-utils/user-management/user-management';
import brooklynApi from 'brooklyn-ui-utils/brooklyn.api/brooklyn.api';

import locationsState from 'views/locations/locations.controller';
import detailState from 'views/detail/detail.controller';
import wizardState from 'views/wizard/wizard.controller';
import wizardAdvancedState from 'views/wizard/advanced/advanced.controller';
import wizardByonState from 'views/wizard/byon/byon.controller';
import wizardCloudState from 'views/wizard/cloud/cloud.controller';

angular.module('app', [ngAnimate, ngCookies, uiRouter, brCore, brServerStatus, brAutoFocus, brInterstitialSpinner, brooklynModuleLinks, brSensitiveField, brooklynUserManagement, brooklynApi, locationsState, detailState, wizardState, wizardAdvancedState, wizardByonState, wizardCloudState])
    .config(['$urlRouterProvider', '$logProvider', applicationConfig])
    .run(['$rootScope', '$state', 'brSnackbar', errorHandler])
    .run(['$http', httpConfig]);

function applicationConfig($urlRouterProvider, $logProvider) {
    $logProvider.debugEnabled(false);
    $urlRouterProvider.otherwise('/');
}

function errorHandler($rootScope, $state, brSnackbar) {
    $rootScope.$on('$stateChangeError', (event, toState, toParams, fromState, fromParams, error)=> {
        if (toState.name === 'detail') {
            brSnackbar.create('Could not locate location [' + toParams.symbolicName + ']');
        }
        $state.go('locations');
    });
}

function httpConfig($http){
    $http.defaults.headers.common['X-Csrf-Token-Required-For-Requests'] = 'write';
}
