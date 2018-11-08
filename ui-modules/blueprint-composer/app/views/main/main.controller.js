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
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from './main.template.html';
import {EntityFamily} from '../../components/util/model/entity.model';
import {graphicalState} from './graphical/graphical.state';
import {yamlState} from './yaml/yaml.state';
import {graphicalEditEntityState} from './graphical/edit/entity/edit.entity.controller';
import {graphicalEditPolicyState} from './graphical/edit/policy/edit.policy.controller';
import {graphicalEditEnricherState} from './graphical/edit/enricher/edit.enricher.controller';
import {graphicalEditSpecState} from './graphical/edit/spec/edit.spec.controller';
import bottomSheetTemplate from './bottom-sheet.template.html';
import {ISSUE_LEVEL} from '../../components/util/model/issue.model';

const LAYERS = [
    {
        id: 'locations',
        label: 'Locations',
        selector: '.node-location',
        active: true
    },
    {
        id: 'adjuncts',
        label: 'Adjuncts',
        selector: '.node-adjuncts',
        active: true
    },
    {
        id: 'memberspecs',
        label: 'Member specs',
        selector: '.spec-node-group',
        active: true
    },
    {
        id: 'relationships',
        label: 'Relationships',
        selector: '.relation-group',
        active: true
    }
];

const COMPOSER_STATE_CACHE_KEY = 'blueprint-composer.state';

export function MainController($scope, $element, $log, $state, $stateParams, brBrandInfo, blueprintService, actionService, catalogApi, applicationApi, brSnackbar, brBottomSheet, edit, yaml, composerOverrides) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    let vm = this;

    if (edit && yaml) {
        throw 'Cannot supply both YAML source and a catalog item to edit';
    }

    // uncomment this to enable dev work on landscape mode
    // vm.experimental = { enableLandscape: true };
    
    vm.mode = $state.current;
    $scope.$on('$stateChangeSuccess', (event, toState)=>{
        vm.mode = toState;
    });

    $scope.composerState = localStorage && localStorage.getItem(COMPOSER_STATE_CACHE_KEY) !== null ?
        JSON.parse(localStorage.getItem(COMPOSER_STATE_CACHE_KEY)) :
        {
            layers: LAYERS,
            viewMode: 'mgmt',
        };
    if ($stateParams.viewMode) $scope.composerState.viewMode = $stateParams.viewMode;
    $scope.$watch('composerState.layers', ()=> {
        $scope.composerState.layers.forEach(layer => {
            document.querySelectorAll(layer.selector).forEach(node => {
                angular.element(node).css('display', layer.active ? 'block' : 'none');
            });
        });
    }, true);
    $scope.$watch('composerState', ()=> {
        if (localStorage) {
            try {
                localStorage.setItem(COMPOSER_STATE_CACHE_KEY, JSON.stringify($scope.composerState));
            } catch (ex) {
                $log.error('Cannot save composer state preferences: ' + ex.message);
            }
        }
    }, true);

    vm.parseError = false;
    $scope.$on('yaml.lint', (event, error)=>{
        $scope.$applyAsync(()=> {
            vm.parseError = error;
        });
    });

    $scope.$on('blueprint.reset', () => {
        vm.saveToCatalogConfig = {};
        blueprintService.reset();
        $state.go($state.includes(yamlState) ? yamlState : graphicalState, {}, {inherit: false, reload: true});
    });
    $scope.$on('blueprint.deploy', () => {
        vm.deployApplication();
    });

    vm.saveToCatalogConfig = {};
    if (edit) {
        vm.saveToCatalogConfig = Object.assign(vm.saveToCatalogConfig, {
            bundle: edit.bundle.symbolicName.replace(/^catalog-bom-/, ''),
            version: edit.type.version,
            symbolicName: edit.type.symbolicName,
            itemType: edit.type.template ? 'template' : 'entity',
            name: edit.type.displayName,
            description: edit.type.description,
            iconUrl: edit.type.iconUrl,
            versions: edit.versions,
        });
        yaml = edit.type.plan.data;
    }

    if (yaml) {
        blueprintService.setFromYaml(yaml);
    } else {
        blueprintService.reset();
    }

    vm.deployApplication = function () {
        if (blueprintService.hasIssues()) {
            vm.displayIssues();
            return;
        }

        deployApplication();
    };

    vm.isGraphicalMode = () => {
        return $state.includes(graphicalState.name);
    };
    vm.viewMode = () => {
        if (!vm.isGraphicalMode()) {
            return 'yaml';
        }
        return $scope.composerState.viewMode;
    };

    vm.getAllActions = () => {
        return actionService.getActions();
    }

    vm.displayIssues = () => {
        let isOnlyWarnings = blueprintService.getIssues().length === blueprintService.getIssues().filter(issue => issue.level === ISSUE_LEVEL.WARN).length;
        let message = '';
        let options = {};
        if (isOnlyWarnings) {
            message = 'Blueprint has some warnings, deployment might fail. Do you wish to proceed anyway?';
            options = {
                label: 'Deploy',
                callback: deployApplication
            }
        } else {
            message = 'Blueprint is not valid: there ' + (
                blueprintService.getIssues().filter(issue => issue.level === ISSUE_LEVEL.ERROR).length > 1 ?
                    'are ' + blueprintService.getIssues().filter(issue => issue.level === ISSUE_LEVEL.ERROR).length + ' problems' :
                    'is 1 problem'
            ) + ' to fix';
        }

        brSnackbar.create(message, options);

        let firstEntityWithIssue = blueprintService.getIssues().filter(issue => {
            if (isOnlyWarnings) {
                return issue.level === ISSUE_LEVEL.WARN;
            } else {
                return issue.level === ISSUE_LEVEL.ERROR;
            }
        })[0].entity;
        switch (firstEntityWithIssue.family) {
            case EntityFamily.ENTITY:
                $state.go(graphicalEditEntityState, {entityId: firstEntityWithIssue._id});
                return;
            case EntityFamily.POLICY:
                $state.go(graphicalEditPolicyState, {entityId: firstEntityWithIssue.parent._id, policyId: firstEntityWithIssue._id});
                return;
            case EntityFamily.ENRICHER:
                $state.go(graphicalEditEnricherState, {entityId: firstEntityWithIssue.parent._id, enricherId: firstEntityWithIssue._id});
                return;
            case EntityFamily.SPEC:
                $state.go(graphicalEditSpecState, {entityId: firstEntityWithIssue.parent._id, specId: firstEntityWithIssue._id});
                return;
        }
    }

    function deployApplication() {
        let bottomSheetOpts = {
            controller: ['$log', 'brBrandInfo', 'brBottomSheetInstance', 'blueprintService', 'applicationApi', bottomSheetController],
            controllerAs: 'ctrl',
            template: bottomSheetTemplate
        };

        brBottomSheet.open(bottomSheetOpts);

        function bottomSheetController($log, brBrandInfo, brBottomSheetInstance, blueprintService, applicationApi) {
            this.loading = true;
            this.vendors = brBrandInfo.getVendorPackages();
             
            this.close = ()=> {
                brBottomSheetInstance.close('Closing deployment error reporting');
            };
            this.investigate = ()=> {
                brBottomSheetInstance.updateMode('inset');
            };
            this.onClipboardSuccess = (e)=> {
                angular.element(e.trigger).triggerHandler('copied');
                e.clearSelection();
            };
            this.onClipboardError = (e)=> {
                let message = '';
                let actionKey = e.action === 'cut' ? 'X' : 'C';
                if(/iPhone|iPad/i.test(navigator.userAgent)) {
                    message = 'No support :(';
                }
                else if(/Mac/i.test(navigator.userAgent)) {
                    message = 'Press ⌘-' + actionKey + ' to ' + e.action;
                }
                else {
                    message = 'Press Ctrl-' + actionKey + ' to ' + e.action;
                }
                brSnackbar.create(message);
            };

            let applicationToDeploy = blueprintService.getAsYaml();
            applicationApi.createApplication(applicationToDeploy).then((success)=> {
                $log.info('Application deployment ... success', success);
                window.location.href = brBrandInfo.getAppDeployedUrl(success.entityId, success.entityId);
            }).catch((error)=> {
                $log.error('Application deployment ... failed', error);
                this.error = {
                    title: 'Application deployment failed',
                    message: error.error.message,
                    details: error.error.details
                };
            }).finally(()=> {
                this.loading = false;
            });
        }
    }

    // allow downstream to configure controller and scope here
    (composerOverrides.configureMainController || function() {})(vm, $scope, $element);
}

export const mainState = {
    name: 'main',
    url: '/?bundleSymbolicName&bundleVersion&typeSymbolicName&typeVersion&yaml',
    abstract: true,
    template: template,
    controller: ['$scope', '$element', '$log', '$state', '$stateParams', 'brBrandInfo', 'blueprintService', 'actionService', 'catalogApi', 'applicationApi', 'brSnackbar', 'brBottomSheet', 'edit', 'yaml', 'composerOverrides', MainController],
    controllerAs: 'vm',
    resolve: {
        edit: ['$stateParams', 'blueprintLoaderApi', ($stateParams, blueprintLoaderApi) => blueprintLoaderApi.loadBlueprint($stateParams)],
        yaml: ['$stateParams', 'blueprintLoaderApi', ($stateParams, blueprintLoaderApi) => blueprintLoaderApi.loadYaml($stateParams)]
    }
};
