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
import brooklynUiModulesApi from 'brooklyn-ui-utils/api/brooklyn/ui-modules';
import brooklynApi from 'brooklyn-ui-utils/brooklyn.api/brooklyn.api';
import uiRouter from 'angular-ui-router';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from './main.template.html';

const MODULE_NAME = 'states.main';

angular.module(MODULE_NAME, [brooklynUiModulesApi, uiRouter, brooklynApi])
    .config(['$stateProvider', mainStateConfig]);

export default MODULE_NAME;

export const mainState = {
    name: 'main',
    url: '/',
    template: template,
    controller: ['$scope', '$state', 'uiModules', 'catalogApps', mainStateController],
    controllerAs: 'vm',
    resolve: {
        uiModules: ['brooklynUiModulesApi', (brooklynUiModulesApi) => {
            return brooklynUiModulesApi.getUiModules();
        }],
        catalogApps: ['catalogApi', (catalogApi) => {
            return catalogApi.getTypes({params: {supertype: 'org.apache.brooklyn.api.entity.Application'}}).then(applications => {
                // optionally tag things with 'catalog_quick_launch': if any apps are so tagged, 
                // then only apps with such tags will be shown;
                // in all cases only show those marked as templates
                var appsWithTag = applications.filter(application => application.tags && application.tags.indexOf("catalog_quick_launch")>=0);
                if (appsWithTag.length) {
                    applications = appsWithTag;
                }
                return applications.filter(application => application.template);
            });
        }]
    }
};

export function mainStateConfig($stateProvider) {
    $stateProvider.state(mainState);
}

export function mainStateController($scope, $state, uiModules, catalogApps) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    this.uiModules = uiModules.filter( (uiModule) => uiModule.types.includes('home-ui-module') );
    this.catalogApps = catalogApps;

    this.pagination = {
        page: 1,
        itemsPerPage: 6
    };
}
