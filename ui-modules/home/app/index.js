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

import brIconGenerator from 'brooklyn-ui-utils/icon-generator/icon-generator';
import brInterstitialSpinner from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import brooklynModuleLinks from 'brooklyn-ui-utils/module-links/module-links';
import brooklynQuickLaunch from 'brooklyn-ui-utils/quick-launch/quick-launch';
import brServerStatus from 'brooklyn-ui-utils/server-status/server-status';
import brooklynUserManagement from 'brooklyn-ui-utils/user-management/user-management';
import brUtilsGeneral from "brooklyn-ui-utils/utils/general";

import mainState from 'views/main/main.controller';
import mainDeployState from 'views/main/deploy/deploy.controller';
import aboutState from 'views/about/about.controller';
import brLogbook from 'brooklyn-ui-utils/logbook/logbook';
import quickLaunchOverrides from 'brooklyn-ui-utils/providers/quick-launch-overrides.provider';
import brooklynPersistenceImporter from 'brooklyn-ui-utils/persistence-importer/persistence-importer';

import brandAngularJs from 'brand-angular-js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || false;

angular.module('brooklynHome', [ngAnimate, ngCookies, uiRouter, brCore, brServerStatus, brIconGenerator,
    brInterstitialSpinner, brooklynModuleLinks, brooklynUserManagement, brooklynQuickLaunch, mainState, mainDeployState,
    aboutState, brLogbook, quickLaunchOverrides, brooklynPersistenceImporter, brUtilsGeneral, brandAngularJs])
    .config(['$urlRouterProvider', '$logProvider', '$compileProvider', applicationConfig])
    .run(['$http', httpConfig]);

function applicationConfig($urlRouterProvider, $logProvider, $compileProvider) {
    $logProvider.debugEnabled(!IS_PRODUCTION);
    $compileProvider.debugInfoEnabled(!IS_PRODUCTION);
    $urlRouterProvider.otherwise('/');
}

function httpConfig($http) {
    $http.defaults.headers.common['X-Csrf-Token-Required-For-Requests'] = 'write';
}
