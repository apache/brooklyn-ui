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
import ngAnimate from 'angular-animate';
import ngResource from "angular-resource";
import ngCookies from "angular-cookies";
import uiRouter from "angular-ui-router";
import "angular-ui-router/release/stateEvents";
import ngClipboard from "ngclipboard";

import brCore from 'brooklyn-ui-utils/br-core/br-core';

import brDragndrop from "brooklyn-ui-utils/dragndrop/dragndrop.directive.js"
import brServerStatus from 'brooklyn-ui-utils/server-status/server-status';
import brAutoFocus from 'brooklyn-ui-utils/autofocus/autofocus';
import brIconGenerator from 'brooklyn-ui-utils/icon-generator/icon-generator';
import brInterstitialSpinner from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import brooklynModuleLinks from 'brooklyn-ui-utils/module-links/module-links';
import brooklynUserManagement from 'brooklyn-ui-utils/user-management/user-management';
import brYamlEditor from 'brooklyn-ui-utils/yaml-editor/yaml-editor';
import brUtils from 'brooklyn-ui-utils/utils/general';

import brSpecEditor from './components/spec-editor/spec-editor.directive';
import brooklynCatalogSaver from './components/catalog-saver/catalog-saver.directive';
import paletteApiProvider from "./components/providers/palette-api.provider";
import paletteServiceProvider from "./components/providers/palette-service.provider";
import blueprintLoaderApiProvider from "./components/providers/blueprint-loader-api.provider";

import brooklynApi from "brooklyn-ui-utils/brooklyn.api/brooklyn.api";
import designer from './components/designer/designer.directive';
import catalogSelector from './components/catalog-selector/catalog-selector.directive';
import customActionDirective from "./components/custom-action/custom-action.directive";
import customConfigSuggestionDropdown from "./components/custom-config-widget/suggestion-dropdown";
import breadcrumbs from "./components/breacrumbs/breadcrumbs.directive";
import objectCache from './components/factories/object-cache.factory';
import entityFilters from "./components/filters/entity.filter";
import locationFilter from "./components/filters/locations.filter";
import blueprintService from "./components/providers/blueprint-service.provider";
import recentlyUsedService from "./components/providers/recently-used-service.provider";
import dslService from "./components/providers/dsl-service.provider";
import paletteDragAndDropService from "./components/providers/palette-dragndrop.provider";
import actionService from "./components/providers/action-service.provider";
import {mainState} from "./views/main/main.controller";
import {yamlState} from "./views/main/yaml/yaml.state";
import {graphicalState} from "./views/main/graphical/graphical.state";
import {graphicalEditState} from "./views/main/graphical/edit/edit.controller";
import {graphicalEditAddState} from "./views/main/graphical/edit/add/add";
import {graphicalEditEntityState} from "./views/main/graphical/edit/entity/edit.entity.controller";
import {graphicalEditPolicyState} from "./views/main/graphical/edit/policy/edit.policy.controller";
import {graphicalEditEnricherState} from "./views/main/graphical/edit/enricher/edit.enricher.controller";
import {graphicalEditSpecState} from "./views/main/graphical/edit/spec/edit.spec.controller";
import {graphicalEditDslState, dslParamLabelFilter} from "./views/main/graphical/edit/dsl/edit.dsl.controller";
import bottomSheet from "brooklyn-ui-utils/bottom-sheet/bottom-sheet";
import stackViewer from 'angular-java-stack-viewer';
import {EntityFamily} from "./components/util/model/entity.model";
import scriptTagDecorator from 'brooklyn-ui-utils/script-tag-non-overwrite/script-tag-non-overwrite';

angular.module('app', [ngAnimate, ngResource, ngCookies, ngClipboard, uiRouter, 'ui.router.state.events', brCore,
    brServerStatus, brAutoFocus, brIconGenerator, brInterstitialSpinner, brooklynModuleLinks, brooklynUserManagement,
    brYamlEditor, brUtils, brSpecEditor, brooklynCatalogSaver, brooklynApi, bottomSheet, stackViewer, brDragndrop,
    customActionDirective, customConfigSuggestionDropdown, paletteApiProvider, paletteServiceProvider, blueprintLoaderApiProvider,
    breadcrumbs, catalogSelector, designer, objectCache, entityFilters, locationFilter, actionService, blueprintService,
    dslService, paletteDragAndDropService, recentlyUsedService, scriptTagDecorator])
    .provider('composerOverrides', composerOverridesProvider)
    .filter('dslParamLabel', ['$filter', dslParamLabelFilter])
    .config(['$urlRouterProvider', '$stateProvider', '$logProvider', applicationConfig])
    .config(['actionServiceProvider', actionConfig])
    .config(['paletteServiceProvider', paletteConfig])
    .run(['$rootScope', '$state', 'brSnackbar', errorHandler])
    .run(['$http', httpConfig]);

function applicationConfig($urlRouterProvider, $stateProvider, $logProvider) {
    $logProvider.debugEnabled(false);
    $urlRouterProvider
        .otherwise(graphicalState.url);
    $stateProvider
        .state(mainState)
        .state(yamlState)
        .state(graphicalState)
        .state(graphicalEditAddState)
        .state(graphicalEditState)
        .state(graphicalEditEntityState)
        .state(graphicalEditPolicyState)
        .state(graphicalEditEnricherState)
        .state(graphicalEditSpecState)
        .state(graphicalEditDslState);
}

function composerOverridesProvider() {
    // callers can do angular.config(['composerOverridesProvider', function (provider) { provider.add({ ... }) })
    // to set various configuration. to see what configuration is supported, grep for composerOverrides in this project.
    var result = {};
    return {
        $get: () => result,
        add: (props) => angular.extend(result, props),
    };
}

function actionConfig(actionServiceProvider) {
    actionServiceProvider.addAction("deploy", {html: '<button class="btn btn-outline btn-success" ng-click="vm.deployApplication()" ng-disabled="vm.deploying">Deploy</button>'});
    actionServiceProvider.addAction("add", {html: '<catalog-saver config="vm.saveToCatalogConfig"></catalog-saver>'});
}

function paletteConfig(paletteServiceProvider) {
    paletteServiceProvider.addSection('entities', {
        title: 'Entities',
        type: EntityFamily.ENTITY,
        icon: 'fa-square-o'
    });
    paletteServiceProvider.addSection('policies', {
        title: 'Policies',
        type: EntityFamily.POLICY,
        icon: 'fa-heartbeat'
    });
    paletteServiceProvider.addSection('enrichers', {
        title: 'Enrichers',
        type: EntityFamily.ENRICHER,
        icon: 'fa-puzzle-piece'
    });
    paletteServiceProvider.addSection('locations', {
        title: 'Locations',
        type: EntityFamily.LOCATION,
        icon: 'fa-map-pin'
    });
}

function errorHandler($rootScope, $state, brSnackbar) {
    $rootScope.$on('$stateChangeError', (event, toState, toParams, fromState, fromParams, error) => {
        brSnackbar.create(error.detail);
        if (toState === yamlState) {
            $state.go(toState);
        } else {
            $state.go(graphicalState);
        }
    });
}

function httpConfig($http) {
    $http.defaults.headers.common['X-Csrf-Token-Required-For-Requests'] = 'write';
}
