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
import angular from "angular";
import ngCookies from "angular-cookies";
import ngResource from "angular-resource";
import ngSanitize from "angular-sanitize";
import uiRouter from "angular-ui-router";
import dropdownNested from "views/main/inspect/activities/detail/dropdown-nested";

import brCore from 'brooklyn-ui-utils/br-core/br-core';

import brUtilsGeneral from "brooklyn-ui-utils/utils/general";
import brServerStatus from 'brooklyn-ui-utils/server-status/server-status';
import brIconGenerator from 'brooklyn-ui-utils/icon-generator/icon-generator';
import brInterstitialSpinner from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import brooklynModuleLinks from 'brooklyn-ui-utils/module-links/module-links';
import brSensitiveField from 'brooklyn-ui-utils/sensitive-field/sensitive-field';
import brooklynUserManagement from 'brooklyn-ui-utils/user-management/user-management';
import brYamlEditor from "brooklyn-ui-utils/yaml-editor/yaml-editor";
import brWebNotifications from 'brooklyn-ui-utils/web-notifications/web-notifications';
import brExpandablePanel from 'brooklyn-ui-utils/expandable-panel/expandable-panel';
import brLogbook from 'brooklyn-ui-utils/logbook/logbook';

import "angular-xeditable";
import apiProvider from "components/providers/api.provider";
import entityTree from "components/entity-tree/entity-tree.directive";
import loadingState from "components/loading-state/loading-state.directive";
import configSensorTable from "components/config-sensor-table/config-sensor-table.directive";
import entityEffector from "components/entity-effector/entity-effector.directive";
import entityPolicy from "components/entity-policy/entity-policy.directive";
import breadcrumbNavigation from "components/breadcrumb-navigation/breadcrumb-navigation";
import taskList from "components/task-list/task-list.directive";
import taskSunburst from "components/task-sunburst/task-sunburst.directive";
import stream from "components/stream/stream.directive";
import adjunctsList from "components/adjuncts-list/adjuncts-list";
import workflowSteps from "components/workflow/workflow-steps.directive";
import workflowStep from "components/workflow/workflow-step.directive";
import {mainState} from "views/main/main.controller";
import {inspectState} from "views/main/inspect/inspect.controller";
import {summaryState, specToLabelFilter} from "views/main/inspect/summary/summary.controller";
import {sensorsState} from "views/main/inspect/sensors/sensors.controller";
import {effectorsState} from "views/main/inspect/effectors/effectors.controller";
import {managementState} from "views/main/inspect/management/management.controller";
import managementDetail from "views/main/inspect/management/detail/detail.controller";
import {activitiesState} from "views/main/inspect/activities/activities.controller";
import {detailState} from "views/main/inspect/activities/detail/detail.controller";
import {streamState} from "views/main/inspect/activities/detail/stream/stream.controller";
import {catalogApiProvider} from "brooklyn-ui-utils/providers/catalog-api.provider";
import {apiObserverInterceptorProvider} from "brooklyn-ui-utils/providers/api-observer-interceptor.provider";

import brandAngularJs from 'brand-angular-js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || false;

angular.module('brooklynAppInspector', [ngResource, ngCookies, ngSanitize, uiRouter, brCore, brUtilsGeneral,
    dropdownNested,
    brServerStatus, brIconGenerator, brInterstitialSpinner, brooklynModuleLinks, brSensitiveField, brooklynUserManagement,
    brYamlEditor, brWebNotifications, brExpandablePanel, 'xeditable', brLogbook, apiProvider, entityTree, loadingState,
    configSensorTable, entityEffector, entityPolicy, breadcrumbNavigation, taskList, taskSunburst, stream, adjunctsList,
    workflowSteps, workflowStep,
    managementDetail, brandAngularJs])
    .provider('catalogApi', catalogApiProvider)
    .provider('apiObserverInterceptor', apiObserverInterceptorProvider)
    .filter('specToLabel', specToLabelFilter)
    .config(['$urlRouterProvider', '$stateProvider', '$logProvider', '$compileProvider', '$httpProvider', 'apiObserverInterceptorProvider', applicationConfig])
    .run(['editableOptions', 'editableThemes', applicationInitialization]);

function applicationConfig($urlRouterProvider, $stateProvider, $logProvider, $compileProvider, $httpProvider, apiObserverInterceptorProvider) {
    $logProvider.debugEnabled(!IS_PRODUCTION);
    $compileProvider.debugInfoEnabled(!IS_PRODUCTION);
    $urlRouterProvider
        .otherwise('/');
    $stateProvider
        .state(mainState)
        .state(inspectState)
        .state(summaryState)
        .state(sensorsState)
        .state(effectorsState)
        .state(managementState)
        .state(activitiesState)
        .state(detailState)
        .state(streamState);
    $httpProvider.interceptors.push('apiObserverInterceptor');
    apiObserverInterceptorProvider.interval(5000);
}

function applicationInitialization(editableOptions, editableThemes) {
    editableThemes.bs3.formTpl = '<form class="editable-wrap" role="form"></form>';
    editableOptions.buttons = 'no';
    editableOptions.icon_set = 'font-awesome';
    editableOptions.theme = 'bs3';
}
