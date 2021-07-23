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
import yaml from 'js-yaml';
import brAutofocus from '../autofocus/autofocus';
import brYamlEditor from '../yaml-editor/yaml-editor';
import template from './quick-launch.html';
import { get, isEmpty } from 'lodash';
// stringifyUrl unavailable, possible webpack issue
import { stringify } from 'query-string';

const MODULE_NAME = 'brooklyn.components.quick-launch';

angular.module(MODULE_NAME, [brAutofocus, brYamlEditor])
    .directive('brooklynQuickLaunch', quickLaunchDirective);

export default MODULE_NAME;

const BROOKLYN_CONFIG = 'brooklyn.config';

export function quickLaunchDirective() {
    return {
        restrict: 'E',
        template: template,
        scope: {
            app: '=',
            locations: '=', // predefined, uploaded location entries
            args: '=?', // default behaviour of code is: { noEditButton: false, noComposerButton: false, noCreateLocationLink: false, location: null }
            callback: '=?',
        },
        controller: ['$scope', '$http', '$location', 'brSnackbar', 'brBrandInfo' , 'quickLaunchOverrides', controller]
    };

    function controller($scope, $http, $location, brSnackbar, brBrandInfo, quickLaunchOverrides) {

        let quickLaunch = this;
        // each function added here will be chained (in order) to process the output of the YAML
        // generator in buildYaml() (ie output:= array[2](array[1](array[0]({ ... getAppPlan() ... })))
        quickLaunch.yamlPostProcessors = [];
        quickLaunch.buildNewApp = () => ({
            name: $scope.model.name || $scope.app.displayName,
            location: $scope.model.location || '<REPLACE>',
            services: [
                angular.copy($scope.entityToDeploy)
            ],
        });
        quickLaunch.planSender = (appYaml) => $http.post('/v1/applications', appYaml);
        quickLaunch.buildComposerYaml = buildComposerYaml;
        quickLaunch.getGraphicalComposerQuery = getGraphicalComposerQuery;
        quickLaunch.getYamlComposerQuery = getYamlComposerQuery;
        quickLaunch.checkForLocationTags = checkForLocationTags;
        quickLaunch.loadLocation = () => {
            const { args, model, locations=[] } = $scope;
            if (args.location) { // inline Location definition passed
                model.location = args.location;
            } else if (locations.length === 1) {
                model.location = locations[0].id; // predefined/uploaded Location objects, ID prop is sufficient
            }
        };


        $scope.simpleComposerOnly = false;
        $scope.formEnabled = true;
        $scope.editorEnabled = !$scope.args.noEditButton;
        $scope.forceFormOnly = false;
        $scope.deploying = false;
        $scope.model = {
            newConfigFormOpen: false,
            
            // should never be null, so the placeholder in UI for model.name will never be used;
            // hence autofocus is disabled
            name: get($scope.app, 'name') || get($scope.app, 'symbolicName', null),
        };
        $scope.args = $scope.args || {};

        $scope.toggleNewConfigForm = toggleNewConfigForm;
        $scope.addNewConfigKey = addNewConfigKey;
        $scope.deleteConfigField = deleteConfigField;
        $scope.deployApp = deployApp;
        $scope.showEditor = showEditor;
        $scope.openComposer = openComposer;
        $scope.hideEditor = hideEditor;
        $scope.clearError = () => { delete $scope.model.deployError; };
        $scope.transitionsShown = () => $scope.editorEnabled && $scope.formEnabled && !$scope.forceFormOnly;

        $scope.$watch('app', () => {
            quickLaunch.loadLocation($scope);
            $scope.clearError();
            $scope.editorYaml = $scope.app.plan.data;

            let parsedPlan = null;
            try {
                parsedPlan = yaml.safeLoad($scope.editorYaml);
            } catch (e) { /*console.log('Failed to parse YAML', e)*/ }

            // enable wizard if it's parseble and doesn't specify a location
            // (if it's not parseable, or it specifies a location, then the YAML view is displayed)
            $scope.formEnabled = $scope.forceFormOnly || (parsedPlan!==null && !checkForLocationTags(parsedPlan));
            $scope.yamlViewDisplayed = !$scope.formEnabled;

            $scope.entityToDeploy = {
                type: $scope.app.symbolicName + ($scope.app.version ? ':' + $scope.app.version : ''),
                [BROOKLYN_CONFIG]: {},
            };
            if ($scope.app.config) {
                $scope.configMap = $scope.app.config.reduce((result, config) => {
                    result[config.name] = config;
                    const configValue = parseConfigValue(get(parsedPlan, `services[0][${BROOKLYN_CONFIG}][${config.name}]`));

                    if (typeof configValue !== 'undefined') {
                        $scope.entityToDeploy[BROOKLYN_CONFIG][config.name] = configValue;
                    } else if (config.pinned || (isRequired(config) && (typeof config.defaultValue !== 'undefined'))) {
                        $scope.entityToDeploy[BROOKLYN_CONFIG][config.name] = parseConfigValue(get(config, 'defaultValue', null));
                    }
                    return result;
                }, {});
            } else {
                $scope.configMap = {};
            }
        });

        $scope.$watch('entityToDeploy', () => {
            $scope.clearError();
        }, true);
        $scope.$watchGroup(['editorYaml', 'model.name', 'model.location'], () => {
            $scope.clearError();
        });

        // Configure this controller from outside. Customization
        (quickLaunchOverrides.configureQuickLaunch || function () {})(quickLaunch, $scope, $http);

        // === Private members below ====================

        function deployApp() {
            $scope.deploying = true;

            Promise.resolve(buildYaml())
                .then(appYaml => {
                    quickLaunch.planSender(appYaml)
                        .then((response) => {
                            if ($scope.callback) {
                                $scope.callback.apply({}, [{state: 'SUCCESS', data: response.data}]);
                            } else {
                                brSnackbar.create('Application Deployed');
                            }
                            $scope.deploying = false;
                        })
                        .catch((senderError) => {
                            // handling API error response. data attribute contains failure message
                            handleDeployError(senderError.data);
                        });
                })
                .catch(err => {
                    handleDeployError(err);
                });
        }

        function handleDeployError(error) {
            $scope.model.deployError = get(error, 'message', 'Unknown error occurred with template preparation.');
            $scope.deploying = false;
        }

        // add config handler
        function toggleNewConfigForm() {
            $scope.model.newConfigFormOpen = !$scope.model.newConfigFormOpen;
            if ($scope.model.newConfigFormOpen) {
                delete $scope.model.newKey;
            }
        }

        // serialize value if it happens to be a complex object
        function parseConfigValue(item) {
            return (typeof item === 'object' && !isEmpty(item))
                ? JSON.stringify(item)
                : item;
        }

        function deleteConfigField(key) {
            delete $scope.entityToDeploy[BROOKLYN_CONFIG][key];
            if (Object.keys($scope.entityToDeploy[BROOKLYN_CONFIG]).length === 0) {
                delete $scope.entityToDeploy[BROOKLYN_CONFIG];
            }
        }

        function addNewConfigKey() {
            const { newKey } = $scope.model;
            if (newKey && newKey.length > 0) {
                let newConfigValue = null;
                const defaultValue = get($scope, `configMap[${newKey}].defaultValue`, null);
                const isBoolean = get($scope, `configMap[${newKey}].type`) === 'java.lang.Boolean';

                if (defaultValue) {
                    newConfigValue = defaultValue;
                }
                if (isBoolean && newConfigValue === null) {
                    newConfigValue = false;
                }

                if (!$scope.entityToDeploy[BROOKLYN_CONFIG]) {
                    $scope.entityToDeploy[BROOKLYN_CONFIG] = {};
                }
                $scope.entityToDeploy[BROOKLYN_CONFIG][$scope.model.newKey] = newConfigValue;
                $scope.focus = $scope.model.newKey;
            }
            $scope.model.newConfigFormOpen = false;
        }

        function buildYaml() {
            // converting JSON to YAML text and then passing through postprocessors, if any
            return [yaml.safeDump, ...quickLaunch.yamlPostProcessors]
                .reduce((prev, cur) => Promise.resolve(prev).then(cur), quickLaunch.buildNewApp());
        }

        function getComposerExpandedYaml(validate) {
            const planText = $scope.app.plan.data || "{}";
            let result = {};

            // this is set if we're able to parse the plan's text definition, and then:
            // - we've had to override a field from the plan's text definition, because a value is set _and_ different; or
            // - the plan's text definition is indented or JSON rather than YAML (not outdented yaml)
            // and in either case we use the result _object_ ...
            // unless we didn't actually change anything, in which case this is ignored
            let cannotUsePlanText = false;

            if (validate) {
                result = yaml.safeLoad(planText);
                if (typeof result !== 'object') {
                    throw "The plan is not a YAML map, but of type "+(typeof result);
                }
                if (!result.services) {
                    throw "The plan does not have any services.";
                }
                cannotUsePlanText = Object.keys(result).some(property =>
                    // plan is not outdented yaml, can't use its text mode
                    !planText.startsWith(property) && !planText.includes('\n'+property+':')
                );
            }

            let newApp = {};

            let newName = $scope.model.name || $scope.app.displayName;
            if (newName && newName != result.name) {
                newApp.name = newName;
                if (result.name) {
                    delete result.name;
                    cannotUsePlanText = true;
                }
            }

            let newLocation = $scope.model.location;
            if (newLocation && newLocation != result.location) {
                newApp.location = newLocation;
                if (result.location) {
                    delete result.location;
                    cannotUsePlanText = true;
                }
            }

            let newConfig = $scope.entityToDeploy[BROOKLYN_CONFIG];
            if (newConfig) {
                if (result[BROOKLYN_CONFIG]) {
                    let oldConfig = result[BROOKLYN_CONFIG];
                    let mergedConfig = angular.copy(oldConfig);
                    for (const [k,v] of Object.entries(newConfig) ) {
                        if (mergedConfig[k] != v) {
                            cannotUsePlanText = true;
                            mergedConfig[k] = v;
                        }
                    }
                    if (cannotUsePlanText) {
                        newApp[BROOKLYN_CONFIG] = mergedConfig;
                        delete result[BROOKLYN_CONFIG];
                    }
                } else {
                    newApp[BROOKLYN_CONFIG] = newConfig;
                }
            }

            // prefer to use the actual yaml input, but if it's not possible
            let tryMergeByConcatenate = Object.keys(newApp).length
                ? yaml.safeDump(newApp, {skipInvalid: true}) + `\n${(validate && cannotUsePlanText) ? yaml.safeDump(result) : planText}`
                : planText;
            if (validate) {
                // don't think there's any way we'd wind up with invalid yaml but check to be sure
                yaml.safeLoad(tryMergeByConcatenate);
            }
            return tryMergeByConcatenate;
        }

        function buildComposerYaml(expanded, validate=true) {
            return expanded
                ? getComposerExpandedYaml(validate)
                : angular.copy($scope.editorYaml);
        }

        function showEditor() {
            Promise.resolve(buildYaml())
                .then(appPlan=>{
                    $scope.editorYaml = appPlan;
                    $scope.yamlViewDisplayed = true;
                    $scope.$apply(); // making sure that $scope is updated from async context
                })
                .catch(error => {
                    console.error('Problem with Editor YAML generation:', error);
                })
        }

        function hideEditor() {
            $scope.yamlViewDisplayed = false;
        }

        function openComposer($event, expanded) {
            $event.preventDefault();
            if (!brBrandInfo.blueprintComposerBaseUrl) {
              console.warn("Composer unavailable in this build");
              return;
            }
            Promise.resolve(quickLaunch.getGraphicalComposerQuery({ expanded }))
                .then(query => {
                    window.location.href = `${brBrandInfo.blueprintComposerBaseUrl}#!/graphical?${stringify(query)}`;
                })
                .catch((error) => {
                    console.warn("Opening composer in YAML text editor mode because we cannot generate a model for this configuration:", error);
                    Promise.resolve(quickLaunch.getYamlComposerQuery({ expanded, validate: false, yamlPrefix:
                            "# This plan may have items which require attention so is being opened in YAML text editor mode.\n"+
                            "# The YAML was autogenerated by merging the plan with any values provided in UI, but issues were\n"+
                            "# detected that mean it might not be correct. Please check the blueprint below carefully.\n"+
                            "\n" }))
                        .then(query => {
                            window.location.href = `${brBrandInfo.blueprintComposerBaseUrl}#!/yaml?${stringify(query)}`;
                        })
                })
        }

        function getGraphicalComposerQuery({ expanded, validate=true }) {
            return new Promise((resolve, reject) => {
                try {
                    resolve({
                        format: $scope.app.plan.format,
                        yaml: quickLaunch.buildComposerYaml(expanded, validate),
                    });
                } catch (err) {
                    reject(err);
                }
            })
        }

        function getYamlComposerQuery({ expanded, validate=true, yamlPrefix='' }) {
            return new Promise((resolve, reject) => {
                try {
                    resolve({
                        format: $scope.app.plan.format,
                        yaml: yamlPrefix + quickLaunch.buildComposerYaml(expanded, validate),
                    });
                } catch (err) {
                    reject(err);
                }
            })
        }
    }

    function isRequired({ constraints }) { // checks if a config field object is required based on its constraints
        return Array.isArray(constraints) && constraints.includes('required');
    }

    // recursive function returning the value of the first `location` property found via DFS, or false
    // if no such property exists.
    function checkForLocationTags(planSegment) {
        if (!planSegment) return false;
        if (planSegment.location) return planSegment.location;

        return checkForLocationTags(planSegment['brooklyn.children']) || checkForLocationTags(planSegment.services);
    }
}
