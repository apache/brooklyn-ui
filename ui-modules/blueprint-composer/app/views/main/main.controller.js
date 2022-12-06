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
import {yamlAutodetectState} from './yaml/yaml.state';
import {graphicalEditEntityState} from './graphical/edit/entity/edit.entity.controller';
import {graphicalEditPolicyState} from './graphical/edit/policy/edit.policy.controller';
import {graphicalEditEnricherState} from './graphical/edit/enricher/edit.enricher.controller';
import {graphicalEditSpecState} from './graphical/edit/spec/edit.spec.controller';
import bottomSheetTemplate from './bottom-sheet.template.html';
import {ISSUE_LEVEL} from '../../components/util/model/issue.model';

const PATHS_SELECTOR_ID = 'relationships-arcs';
const LABELS_SELECTOR_ID = 'relationships-labels';

export const LAYERS = [
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
        id: PATHS_SELECTOR_ID,
        label: 'Relationship arcs',
        selector: '.relation-arc',
        active: true
    },
    {
        id: LABELS_SELECTOR_ID,
        label: 'Relationship labels',
        selector: '.relation-label',
        active: true
    },
    {
        id: 'annotations',
        label: 'Annotations',
        selector: '.node-annotation',
        active: true
    },
];
const LAYER_CACHE_KEY = 'blueprint-composer.layers';

export function MainController($scope, $element, $log, $state, $stateParams, brBrandInfo, blueprintService, actionService, tabService, catalogApi, applicationApi, brSnackbar, brBottomSheet, composerOverrides, edit, yaml) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    let vm = this;

    if (edit && yaml) {
        throw 'Cannot supply both YAML source and a catalog item to edit';
    }

    vm.mode = $state.current;
    $scope.$on('$stateChangeSuccess', (event, toState)=>{
        vm.mode = toState;
    });

    let layersM = {};
    (composerOverrides.getLayers && composerOverrides.getLayers() || LAYERS).forEach(l => layersM[l.id] = l);

    let layersL = localStorage && localStorage.getItem(LAYER_CACHE_KEY) !== null && JSON.parse(localStorage.getItem(LAYER_CACHE_KEY));
    if (layersL) layersL.forEach(l => { if (layersM[l.id]) layersM[l.id] = Object.assign({}, layersM[l.id], l); });
    vm.layers = Object.values(layersM);

    vm.onLayerActive = (layer, value) => {
        if (layer.onLayerActive) {
            layer.onLayerActive(value, $scope);
        }
        layer.active = value;
    };
    vm.layers.forEach(l => vm.onLayerActive(l, l.active));

    const applyFilters = () => {
        vm.layers.forEach(layer => {
            document.querySelectorAll(layer.selector).forEach(node => {
                // if (layer.apply) {
                //     // layers could supply custom layer behaviour (including via composer overrides)
                //     layer.apply(node, layer, angular.element(node));
                // } else {
                angular.element(node).css('display', layer.active ? 'block' : 'none');
                // }
            });
        });
        if (localStorage) {
            try {
                localStorage.setItem(LAYER_CACHE_KEY, JSON.stringify(vm.layers));
            } catch (ex) {
                $log.error('Cannot save layers preferences: ' + ex.message);
            }
        }
    };

    // Relationship arcs and labels.
    let isRelationshipArcsLayerActive = true;
    let isRelationshipLabelsLayerActive = true;

    // Re-apply filters when selected filters changed or graph is changed.
    $scope.$watch('vm.layers', () => {
        applyFilters();

        let relationshipArcsLayer = vm.layers.find(l => l.id === PATHS_SELECTOR_ID);
        let relationshipLabelsLayer = vm.layers.find(l => l.id === LABELS_SELECTOR_ID);

        // Turning on labels turns on arcs.
        if (relationshipLabelsLayer.active && !isRelationshipLabelsLayerActive) {
            relationshipArcsLayer.active = true;
        }

        // Turning off arcs turns off labels.
        if (!relationshipArcsLayer.active && isRelationshipArcsLayerActive) {
            relationshipLabelsLayer.active = false;
        }

        // Update cached state for arc and labels.
        isRelationshipArcsLayerActive = relationshipArcsLayer.active;
        isRelationshipLabelsLayerActive = relationshipLabelsLayer.active;

    }, true);

    $scope.$on('layers.filter', () => applyFilters());

    $scope.$on('yaml.lint', (event, hasErrors)=>{
        $scope.$applyAsync(()=> {
            vm.saveToCatalogConfig.hasErrors = hasErrors
        });
    });

    $scope.$on('blueprint.reset', () => {
        vm.saveToCatalogConfig = {};
        blueprintService.reset();
        $state.go(vm.isYamlMode() ? $state.current : graphicalState, {}, {inherit: false, reload: true});
    });
    $scope.$on('blueprint.deploy', () => {
        vm.deployApplication();
    });
    $scope.$on('blueprint.continue', () => {
        blueprintService.refreshBlueprintMetadata();
    });

    vm.saveToCatalogConfig = {};
    if (edit) {
        // 'edit' is the details of an existing blueprint from catalog being edited, which via state parameters are loaded and passed to controller
        // it might be a template in which case we take the values SUGGESTED BY the template and make them _current_
        // or it might be an existing bundle (non-template), in which case we take the values OF the item being edited
        console.log("EDIT TYPE", edit.type);
        console.log("VERSIONS", edit.versions);
        console.log("EDIT", edit);
        vm.saveToCatalogConfig = Object.assign(vm.saveToCatalogConfig, {
            initial: {
                version: edit.type.version,
                description: edit.type.description,
                iconUrl: edit.type.iconUrlSource || edit.type.iconUrl,
            },
            original: {
                bundle: edit.bundle.symbolicName.replace(/^catalog-bom-/, ''),
                symbolicName: edit.type.symbolicName,
                name: edit.type.displayName,
                itemType: edit.type.template ? 'template'
                    : !edit.type.superTypes || edit.type.superTypes.contains("org.apache.brooklyn.api.entity.Application") ? 'application'
                    : 'entity', 
            },
            default: {},
        });

        if (!edit.type.template) {
            // set name, bundle, symbolicName, and itemType unless we are a template
            // or in other words, for other items, DO set these
            vm.saveToCatalogConfig.initial.template = false;
            ['itemType','bundle','symbolicName','name'].forEach(key => vm.saveToCatalogConfig.initial[key] = vm.saveToCatalogConfig.original[key]);
            // no defaults supplied by this view
            // [].forEach(key => vm.saveToCatalogConfig.default[key] = vm.saveToCatalogConfig.original[key]);
            vm.saveToCatalogConfig.versions = edit.versions; // only set if not a template

        } else {
            // if we are from a template the name etc should be blank (could use a placeholder)
            vm.saveToCatalogConfig.initial.template = edit.type.template;
            vm.saveToCatalogConfig.initial.itemType = 'application';
        }

        $scope.initialYamlFormat = $stateParams.format;
        if($scope.initialYamlFormat && Array.isArray(edit.type.specList) && edit.type.specList.length > 0 && edit.type.specList[0].format === $scope.initialYamlFormat) {
            yaml = edit.type.specList[0].contents; // for YAML editor
        }  else {
            // for graphical editor
            yaml = edit.type.plan.data;
        }
    }

    vm.isTabActive = stateKey => {
        return $state.is(stateKey);
    }
    vm.isYamlMode = () => {
        return $state && $state.current && $state.current.name && $state.current.name.includes(yamlAutodetectState.name);
    }
    vm.isLayerDropdownEnabled = () => {
        return !vm.isYamlMode();
    }

    if (yaml) {
        if (vm.isYamlMode()) {
            // don't set blueprint; yaml mode will take from "initial yaml" 
            blueprintService.reset();
            $scope.initialYaml = yaml;
        } else {
            try {
                blueprintService.setFromYaml(yaml);
            } catch (e) {
                console.warn("YAML supplied for editing is not valid for a blueprint. It will be ignored unless opened in the YAML editor:", e);
                blueprintService.reset();
                $scope.initialYaml = yaml;
            }
        }
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

    vm.getAllActions = () => {
        return actionService.getActions();
    }

    vm.getAllTabs = () => {
        return tabService.getTabs();
    }

    vm.displayIssues = () => {
        let isOnlyWarnings = blueprintService.getIssues().length === blueprintService.getIssues().filter(issue => issue.level === ISSUE_LEVEL.WARN).length;
        let message = '';
        let action = {};
        let options = { timeout: 15*1000, class: 'snackbar-top-right' };
        if (isOnlyWarnings) {
            message = 'Blueprint has warnings which may cause the deployment to fail. Do you wish to proceed anyway?';
            action = {
                label: 'Deploy',
                callback: deployApplication
            }
            options.closeText = 'Cancel';
        } else {
            message = 'Blueprint is not valid: there ' + (
                blueprintService.getIssues().filter(issue => issue.level === ISSUE_LEVEL.ERROR).length > 1 ?
                    'are ' + blueprintService.getIssues().filter(issue => issue.level === ISSUE_LEVEL.ERROR).length + ' problems' :
                    'is 1 problem'
            ) + ' to fix';
            options.closeText = 'OK';
        }

        brSnackbar.create(message, action, options);

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
    url: '?bundleSymbolicName&bundleVersion&typeSymbolicName&typeVersion&yaml&format',
    abstract: true,
    template: template,
    controller: ['$scope', '$element', '$log', '$state', '$stateParams', 'brBrandInfo', 'blueprintService', 'actionService', 'tabService', 'catalogApi', 'applicationApi', 'brSnackbar', 'brBottomSheet', 'composerOverrides', 'edit', 'yaml', MainController],
    controllerAs: 'vm',
    resolve: {
        edit: ['$stateParams', 'blueprintLoaderApi', ($stateParams, blueprintLoaderApi) => blueprintLoaderApi.loadBlueprint($stateParams)],
        yaml: ['$stateParams', 'blueprintLoaderApi', ($stateParams, blueprintLoaderApi) => blueprintLoaderApi.loadYaml($stateParams)]
    }
};
