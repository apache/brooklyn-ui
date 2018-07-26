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

import brSpecEditor from 'components/spec-editor/spec-editor.directive';
import brooklynCatalogSaver from 'components/catalog-saver/catalog-saver.directive';
import paletteApiProvider from "./components/providers/palette-api.provider"

import brooklynApi from "brooklyn-ui-utils/brooklyn.api/brooklyn.api";
import {designerDirective} from "components/designer/designer.directive";
import {
    catalogSelectorDirective,
    catalogSelectorSearchFilter,
    catalogSelectorSortFilter
} from "components/catalog-selector/catalog-selector.directive";
import customActionDirective from "./components/custom-action/custom-action.directive";
import {onErrorDirective} from "components/catalog-selector/on-error.directive";
import {breadcrumbsDirective} from "components/breacrumbs/breadcrumbs.directive";
import {recursionHelperFactory} from "components/factories/recursion-helper.factory";
import {objectCacheFactory} from 'components/factories/object-cache.factory';
import {entityNameFilter, entityVersionFilter, entityTypesFilter} from "components/filters/entity.filter";
import {locationsFilter} from "components/filters/locations.filter";
import {blueprintServiceProvider} from "components/providers/blueprint-service.provider";
import {dslServiceProvider} from "components/providers/dsl-service.provider";
import {paletteDragAndDropServiceProvider} from "components/providers/palette-dragndrop.provider";
import {actionServiceProvider} from "./components/providers/action-service.provider";
import {mainState} from "views/main/main.controller";
import {yamlState} from "views/main/yaml/yaml.state";
import {graphicalState} from "views/main/graphical/graphical.state";
import {graphicalEditState} from "views/main/graphical/edit/edit.controller";
import {graphicalEditAddState} from "views/main/graphical/edit/add/add";
import {graphicalEditEntityState} from "views/main/graphical/edit/entity/edit.entity.controller";
import {graphicalEditPolicyState} from "views/main/graphical/edit/policy/edit.policy.controller";
import {graphicalEditEnricherState} from "views/main/graphical/edit/enricher/edit.enricher.controller";
import {graphicalEditSpecState} from "views/main/graphical/edit/spec/edit.spec.controller";
import {graphicalEditDslState, dslParamLabelFilter} from "views/main/graphical/edit/dsl/edit.dsl.controller";
import bottomSheet from "brooklyn-ui-utils/bottom-sheet/bottom-sheet";
import stackViewer from 'angular-java-stack-viewer';

angular.module('app', [ngAnimate, ngResource, ngCookies, ngClipboard, uiRouter, 'ui.router.state.events', brCore, brServerStatus, brAutoFocus, brIconGenerator, brInterstitialSpinner, brooklynModuleLinks, brooklynUserManagement, brYamlEditor, brUtils, brSpecEditor, brooklynCatalogSaver, brooklynApi, bottomSheet, stackViewer, brDragndrop, customActionDirective, paletteApiProvider])
    .directive('designer', ['$log', '$state', '$q', 'iconGenerator', 'catalogApi', 'blueprintService', 'brSnackbar', 'paletteDragAndDropService', designerDirective])
    .directive('onError', onErrorDirective)
    .directive('catalogSelector', catalogSelectorDirective)
    .directive('breadcrumbs', breadcrumbsDirective)
    .provider('blueprintService', blueprintServiceProvider)
    .provider('dslService', dslServiceProvider)
    .provider('paletteDragAndDropService', paletteDragAndDropServiceProvider)
    .provider('actionService', actionServiceProvider)
    .factory('recursionHelper', ['$compile', recursionHelperFactory])
    .factory('objectCache', ['$cacheFactory', objectCacheFactory])
    .filter('entityName', entityNameFilter)
    .filter('entityVersion', entityVersionFilter)
    .filter('entityTypes', entityTypesFilter)
    .filter('locations', locationsFilter)
    .filter('catalogSelectorSearch', catalogSelectorSearchFilter)
    .filter('catalogSelectorSort', ['$filter', catalogSelectorSortFilter])
    .filter('dslParamLabel', ['$filter', dslParamLabelFilter])
    .config(['$urlRouterProvider', '$stateProvider', '$logProvider', applicationConfig])
    .config(['actionServiceProvider', actionConfig])
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

function actionConfig(actionServiceProvider) {
    actionServiceProvider.addAction("deploy", {html: '<button class="btn btn-success" ng-click="vm.deployApplication()" ng-disabled="vm.deploying">Deploy</button>'});
    actionServiceProvider.addAction("add", {html: '<catalog-saver config="vm.saveToCatalogConfig"></catalog-saver>'});
}

function errorHandler($rootScope, $state, brSnackbar) {
    $rootScope.$on('$stateChangeError', (event, toState, toParams, fromState, fromParams, error)=> {
        brSnackbar.create(error.detail);
        if (toState === yamlState) {
            $state.go(toState);
        } else {
            $state.go(graphicalState);
        }
    });
}

function httpConfig($http){
    $http.defaults.headers.common['X-Csrf-Token-Required-For-Requests'] = 'write';
}
