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
import groovyEditor from 'brooklyn-ui-utils/groovy-editor/groovy-editor.directive';
import scriptApi from 'brooklyn-ui-utils/api/brooklyn/script';
import uiRouter from 'angular-ui-router';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from './main.template.html';

const MODULE_NAME = 'states.groovy-view';

angular.module(MODULE_NAME, [groovyEditor, scriptApi, uiRouter])
    .config(['$stateProvider', mainStateConfig]);

export default MODULE_NAME;

export const mainState = {
    name: 'main',
    url: '/',
    template: template,
    controller: ['$scope', 'scriptApi', mainStateController],
    controllerAs: 'vm'
};

export function mainStateConfig($stateProvider) {
    $stateProvider.state(mainState);
}

export function mainStateController($scope, scriptApi) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    // Controller code goes here

    $scope.loadExample = loadExample;
    $scope.submitCode = submitCode;
    $scope.codeToRun = "";
    $scope.problemText = "";
    $scope.resultText = "";
    $scope.stdout = "";
    $scope.stderr = "";
    $scope.hideResults = true;
    $scope.disableSubmit = false;

    function loadExample() {
        $scope.codeToRun =
            'import static org.apache.brooklyn.core.entity.Entities.*\n' +
            '\n' +
            'println "Last result: "+last\n' +
            'data.exampleRunCount = (data.exampleRunCount ?: 0) + 1\n' +
            'println "Example run count: ${data.exampleRunCount}"\n' +
            '\n' +
            'println "Application count: ${mgmt.applications.size()}\\n"\n' +
            '\n' +
            'mgmt.applications.each { dumpInfo(it) }\n' +
            '\n' +
            'return mgmt.applications\n';
        $scope.hideResults = true;
        $scope.disableSubmit = false;
    }

    function submitCode() {
        $scope.hideResults = true;
        $scope.disableSubmit = true;
        scriptApi.runGroovyScript($scope.codeToRun).then(function (success) {
            $scope.resultText = success.result || "";
            $scope.problemText = success.problem || "";
            $scope.stdout = success.stdout || "";
            $scope.stderr = success.stderr || "";
        }, function (error) {
            $scope.resultText = error.status || "no status";
            $scope.problemText = error.error || "no error message";
            $scope.stdout = "";
            $scope.stderr = "";
        }).finally(() => {
            $scope.hideResults = false;
            $scope.disableSubmit = false;
        });
    }
}

