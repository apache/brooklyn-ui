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
import template from './main.template.html';

const MODULE_NAME = 'main.state';

angular.module(MODULE_NAME, [uiRouter])
    .config(['$stateProvider', mainStateConfig]);

export default MODULE_NAME;

export const mainState = {
    name: 'main',
    url: '/',
    template: template,
    controller: ['$scope', '$log', '$cookies', mainStateController],
    controllerAs: 'vm'
};

export function mainStateConfig($stateProvider) {
    $stateProvider.state(mainState);
}

export function mainStateController($scope, $log, $cookies) {
    let swaggerUi = new SwaggerUi({
        url: '/v1/apidoc/swagger.json',
        dom_id: 'swagger-ui-container',
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        onFailure: (data)=> {
            $log.error('Unable to Load SwaggerUI');
        },
        onComplete: (swaggerApi, swaggerUi)=> {
            swaggerApi.clientAuthorizations.add('X-CSRF-TOKEN', new SwaggerClient.ApiKeyAuthorization('X-CSRF-TOKEN', $cookies.get('CSRF-TOKEN'), 'header'));
            $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
        },
        docExpansion: 'none',
        jsonEditor: false,
        defaultModelRendering: 'schema',
        showRequestHeaders: false,
        showOperationIds: false
    });

    swaggerUi.load();
}
