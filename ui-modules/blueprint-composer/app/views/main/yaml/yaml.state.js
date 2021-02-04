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
import CodeMirror from 'codemirror';
import {YAMLException} from 'js-yaml';


export const yamlAutodetectState = {
    // TODO make this do auto-detect
    name: 'main.yaml',
    url: 'yaml',
    template: '<br-yaml-editor value="vm.yaml" type="blueprint"></br-yaml-editor>',
    controller: ['$scope', '$rootScope', '$timeout', 'blueprintService', 'brSnackbar', yamlStateController],
    controllerAs: 'vm',
    data: {
        label: 'YAML Editor'
    }
}
export const yamlCampState = {
    name: 'main.yaml.camp',
    url: 'camp',
    template: '<br-yaml-editor value="vm.yaml" type="blueprint"></br-yaml-editor>',
    controller: ['$scope', '$rootScope', '$timeout', 'blueprintService', 'brSnackbar', yamlStateController],
    controllerAs: 'vm',
    data: {
        label: 'YAML Editor'
    }
};

function yamlStateController($scope, $rootScope, $timeout, blueprintService, brSnackbar) {
    let vm = this;

    try {
        vm.yaml = blueprintService.getAsYaml();
    } catch (ex) {
        brSnackbar.create(`Cannot load blueprint: ${ex.message}`);
        vm.yaml = '';
    }
    if ($scope.initialYaml && !vm.yaml) {
        // either yaml was supplied and yaml mode requested, skipping blueprint setup,
        // or the yaml was invalid, an error logged, and this was recorded
        vm.yaml = $scope.initialYaml; 
    }

    if (!CodeMirror.lint.hasOwnProperty('yaml-composer')) {
        CodeMirror.registerGlobalHelper('lint', 'yaml-composer', mode => mode.name === 'yaml', (text, options, cm) => {
            let issues = [];

            try {
                blueprintService.setFromYaml(cm.getValue(), true);
                //// the model of types etc is not updated in the YAML view; the line below will fix this
                //// but it makes 1 request per type (even if duplicated) on _every_ keypress (modulo a minor debounce)
                //// so it isn't worth it for now.  we should have a cache at which point the below could be supported again.
                //// also it might make sense to do it in the `setFromYaml` method above instead of explicitly below.  
                // blueprintService.refreshBlueprintMetadata();
                
            } catch (err) {
                if (!(err instanceof YAMLException)) {
                    issues.push({
                        from: CodeMirror.Pos(0, 0),
                        to: CodeMirror.Pos(0, 0),
                        message: err.message
                    });
                }
            }

            return issues;
        });
    }
}
