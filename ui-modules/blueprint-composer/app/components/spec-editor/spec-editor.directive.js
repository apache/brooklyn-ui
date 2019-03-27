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
import onEnter from 'brooklyn-ui-utils/on-enter/index';
import autoGrow from 'brooklyn-ui-utils/autogrow/index';
import blurOnEnter from 'brooklyn-ui-utils/blur-on-enter/index';
import {EntityFamily, baseType} from '../util/model/entity.model';
import {Dsl} from '../util/model/dsl.model';
import {Issue, ISSUE_LEVEL} from '../util/model/issue.model';
import {RESERVED_KEYS, DSL_ENTITY_SPEC} from '../providers/blueprint-service.provider';
import brooklynDslEditor from '../dsl-editor/dsl-editor';
import brooklynDslViewer from '../dsl-viewer/dsl-viewer';
import template from './spec-editor.template.html';
import {graphicalState} from '../../views/main/graphical/graphical.state';

const MODULE_NAME = 'brooklyn.components.spec-editor';
const ANY_MEMBERSPEC_REGEX = /(^.*[m,M]ember[s,S]pec$)/;
const REPLACED_DSL_ENTITYSPEC = '___brooklyn:entitySpec';

angular.module(MODULE_NAME, [onEnter, autoGrow, blurOnEnter, brooklynDslEditor, brooklynDslViewer])
    .directive('specEditor', ['$rootScope', '$templateCache', '$injector', '$sanitize', '$filter', '$log', '$sce', '$timeout', '$document', '$state', '$compile', 'blueprintService', 'composerOverrides', specEditorDirective])
    .filter('specEditorConfig', specEditorConfigFilter)
    .filter('specEditorType', specEditorTypeFilter)
    .run(['$templateCache', templateCache]);

const TEMPLATE_URL = 'blueprint-composer/component/spec-editor/spec-editor.template.html';

export default MODULE_NAME;

export const CONFIG_FILTERS = [
    {
        id: 'suggested',
        label: 'Suggested',
        filter: (item)=> {
            return item.pinned && item.priority > -1;
        }
    },
    {
        id: 'required',
        label: 'Required',
        filter: (item, model)=> {
            return (item.constraints && item.constraints.required) ||
                (model && model.issues && model.issues.some((issue)=>(issue.group === 'config' && issue.ref === item.name)) );
        }
    },
    {
        id: 'inuse',
        label: 'In Use',
        filter: (item, model)=> {
            return model && model.config && model.config.has(item.name);
        }
    },
    {
        id: 'all',
        label: 'All',
        filter: (item)=> {
            return item;
        }
    }
];

export function specEditorDirective($rootScope, $templateCache, $injector, $sanitize, $filter, $log, $sce, $timeout, $document, $state, $compile, blueprintService, composerOverrides) {
    return {
        restrict: 'E',
        scope: {
            model: '='
        },
        controller: ['$scope', '$element', controller],
        templateUrl: function (tElement, tAttrs) {
            return tAttrs.templateUrl || TEMPLATE_URL;
        },
        link: link,
        controllerAs: 'specEditor',
    };

    function controller($scope, $element) {
        (composerOverrides.configureSpecEditorController || function () {
        })(this, $scope, $element);

        // does very little currently, but link adds to this
        return this;
    }

    function link(scope, element, attrs, specEditor) {
        scope.specEditor = specEditor;
        scope.addConfigKey = addConfigKey;
        scope.FAMILIES = EntityFamily;
        scope.RESERVED_KEYS = RESERVED_KEYS;
        scope.REPLACED_DSL_ENTITYSPEC = REPLACED_DSL_ENTITYSPEC;
        scope.parameters = [];
        scope.config = {};

        specEditor.getParameter = getParameter;
        specEditor.addParameter = addParameter;
        specEditor.removeParameter = removeParameter;

        let defaultState = {
            parameters: {
                add: {
                    value: '',
                    open: false
                },
                edit: {
                    value: '',
                    name: '',
                    open: false,
                },
                search: '',
                focus: '',
                filter: {
                    open: false,
                },
                open: false,

                codeModeActive: {},
                codeModeError: {},
            },
            config: {
                add: {
                    value: '',
                    open: false
                },
                search: '',
                focus: '',
                filter: {
                    values: { suggested: true, required: true, inuse: true },
                    open: false,
                },
                // TODO would be nice to set null here, then have it go true if there is filtered config
                // but the collapsible widget doesn't seem to respond to subsequent state changed
                open: true,

                dslViewerManualOverride: {},
                codeModeActive: {},
                codeModeForced: {},
                codeModeError: {},
                customConfigWidgetMetadata: {},
            },
            location: {
                open: false
            },
            policy: {
                search: '',
                open: false
            },
            enricher: {
                search: '',
                open: false
            }
        };

        // allow downstream to configure this controller and/or scope
        (composerOverrides.configureSpecEditor || function () {
        })(specEditor, scope, element, $state, $compile, $templateCache);

        scope.filters = {
            config: CONFIG_FILTERS,
        };
        scope.isFilterDisabled = (filter) => filter.id !== 'all' && scope.state.config.filter.values['all'];
        scope.onFilterClicked = (filter) => {
            if (!scope.isFilterDisabled(filter)) scope.state.config.filter.values[filter.id] = !scope.state.config.filter.values[filter.id];
        };

        scope.state = sessionStorage && sessionStorage.getItem(scope.model._id)
            ? JSON.parse(sessionStorage.getItem(scope.model._id))
            : defaultState;
        scope.$watch('state', () => {
            if (sessionStorage) {
                try {
                    sessionStorage.setItem(scope.model._id, JSON.stringify(scope.state));
                } catch (ex) {
                    $log.error('Cannot save edit state: ' + ex.message);
                }
            }
        }, true);
        scope.$watch('state.config.filter.values', () => {
            scope.state.config.add.list = getAddListConfig();
        });

        loadCustomConfigWidgetMetadata(scope);

        // Model
        scope.$watch('model', (newVal, oldVal) => {
            if (newVal && !newVal.equals(oldVal)) {
                loadLocalConfigFromModel();
                loadLocalParametersFromModel();
            }
        }, true);
        scope.$watch('model.id', () => {
            blueprintService.refreshAllRelationships();
        });

        scope.$watch('state.parameters', (newVal, oldVal) => {
            setModelFromLocalParameters();
        }, true);

        // Parameters
        scope.$watch('parameters', (newVal, oldVal) => {
            setModelFromLocalParameters();
            scope.model.clearIssues({group: 'parameters'});
        }, true);

        // Config
        scope.$watch('config', (newVal, oldVal) => {
            setModelFromLocalConfig();
            scope.model.clearIssues({group: 'config'});
            blueprintService.refreshRelationships(scope.model).then(() => {
                return blueprintService.refreshConfigConstraints(scope.model);
            }).then(() => {
                refreshCustomValidation(scope.model);
            });
        }, true);

        scope.getObjectSize = (object) => {
            return specEditor.defined(object) && object != null ? Object.keys(object).length : 0;
        };

        function findNext(element, clazz, stopClazz) {
            let el = element, last = null;
            while (last !== el) {
                last = el;
                if (el.children().length) {
                    el = angular.element(el.children()[0]);
                } else {
                    while (el.length && !el.next().length) {
                        el = el.parent();
                    }
                    el = el.next();
                }
                if (el.hasClass(clazz)) {
                    return el;
                }
                if (stopClazz && el.hasClass(stopClazz)) break;
            }
            return null;
        }

        function findPrev(element, clazz, stopClazz) {
            let el = element, last = null;
            while (last !== el) {
                last = el;
                if (el.children().length) {
                    // this still does children first, not ideal but okay for how we use it
                    el = angular.element(el.children()[el.children().length - 1]);
                } else {
                    while (el.length && !el[0].previousElementSibling) {
                        el = el.parent();
                    }
                    el = angular.element(el[0].previousElementSibling);
                }
                if (el.hasClass(clazz)) {
                    return el;
                }
                if (stopClazz && el.hasClass(stopClazz)) break;
            }
            return null;
        }

        function findAncestor(element, clazz, stopClazz) {
            let el = element, last = null;
            while (last !== el) {
                last = el;
                el = el.parent();
                if (el.hasClass(clazz)) {
                    return el;
                }
                if (stopClazz && el.hasClass(stopClazz)) return null;
            }
            return null;
        }

        function focusIfPossible(event, next) {
            if (next && next.length) {
                if (event) event.preventDefault();
                if (event) event.stopPropagation();
                next[0].focus();
                return true;
            } else {
                return false;
            }
        }

        scope.nonempty = (o) => o && Object.keys(o).length;
        scope.defined = specEditor.defined = (o) => (typeof o !== 'undefined');
        specEditor.advanceOutToFormGroupInPanel = (element, event) => {
            focusIfPossible(event, findAncestor(element, "form-group", "panel-body")) || element[0].blur();
        };
        specEditor.advanceControlInFormGroup = (element, event) => {
            focusIfPossible(event, findNext(element, "form-control", "form-group")) ||
            specEditor.advanceOutToFormGroupInPanel(element, event);
        };

        scope.onAddMapProperty = (configKey, key, ev) => {
            if (key) {
                if (!scope.config[configKey]) {
                    scope.config[configKey] = {};
                }
                if (!scope.config[configKey].hasOwnProperty(key)) {
                    scope.config[configKey][key] = '';

                    // defer so control exists, then focus on previous item (new control)
                    $timeout(() => {
                        let element = angular.element(ev.target);
                        let prev = findPrev(element, "form-control", "form-group");
                        focusIfPossible(null, prev) ||
                        specEditor.advanceOutToFormGroupInPanel(element, null);
                    }, 0);
                } else {
                    // user entered a key that already exists;
                    // would be nice to select the item they requested but with just jqlite that's more pain than it's worth!
                }
            }
        };
        scope.cycleExpandMode = specEditor.cycleExpandMode = function (expandMode, ctx, item, focus) {
            return expandMode === 'default' ? 'open' :
                expandMode === 'open' ? 'closed' :
                    'default';
        };
        scope.onDeleteMapProperty = specEditor.onDeleteMapProperty = function (model, key) {
            if (model && model.hasOwnProperty(key)) {
                delete model[key];
            }
        };
        scope.onAddListItem = specEditor.onAddListItem = (configKey, item, ev) => {
            if (item) {
                if (!scope.config[configKey]) {
                    scope.config[configKey] = [];
                }
                if (scope.config[configKey].indexOf(item) === -1) {
                    scope.config[configKey].push(item);
                }
                ev.target.focus();
            }
        };
        scope.onDeleteListItem = specEditor.onDeleteListItem = function (model, index) {
            if (model && index < model.length) {
                model.splice(index, 1);
            }
        };
        scope.isConfigHidden = specEditor.isConfigHidden = (config) => {
            let allConfig = scope.model.miscData.get('config');
            if (allConfig.indexOf(config) === -1) {
                return false;
            }
            return $filter('specEditorConfig')(allConfig, scope.state.config.filter.values).indexOf(config) === -1;
        };
        scope.onFocusOnConfig = specEditor.onFocusOnConfig = ($item) => {
            scope.state.config.search = '';
            scope.state.config.add.value = '';
            scope.state.config.add.open = false;
            scope.state.config.focus = $item.name;
            if ($item.isHidden) {
                scope.state.config.filter.values.all = true;
            }
        };
        scope.onFocusOnParameter = specEditor.onFocusOnParameter = ($item) => {
            scope.state.parameters.search = '';
            scope.state.parameters.add.value = '';
            scope.state.parameters.add.open = false;
            scope.state.parameters.focus = $item.name;
        };
        scope.recordConfigFocus = specEditor.recordConfigFocus = ($item) => {
            scope.state.config.focus = $item.name;
        };
        scope.recordParameterFocus = specEditor.recordParameterFocus = ($item) => {
            scope.state.parameters.focus = $item.name;
            scope.state.parameters.edit = {
                item: $item,
                newName: $item.name,
                constraints: $item.constraints ? JSON.stringify($item.constraints) : '',
                json: JSON.stringify($item, null, "  "),
            };
        };

        scope.removeAdjunct = ($event, adjunct) => {
            $event.preventDefault();
            $event.stopPropagation();
            switch (adjunct.family) {
                case EntityFamily.POLICY:
                    scope.model.removePolicy(adjunct._id);
                    break;
                case EntityFamily.ENRICHER:
                    scope.model.removeEnricher(adjunct._id);
                    break;
            }
        };

        scope.removeModel = () => {
            switch (scope.model.family) {
                case EntityFamily.ENRICHER:
                    scope.model.parent.removeEnricher(scope.model._id);
                    break;
                case EntityFamily.POLICY:
                    scope.model.parent.removePolicy(scope.model._id);
                    break;
                default:
                    $rootScope.$broadcast('d3.remove', scope.model);
                    break;
            }
            $state.go(graphicalState.name);
        };

        specEditor.getParameterIssues = () => {
            return scope.model.issues
                .filter((issue) => (issue.group === 'parameters'))
                .concat(Object.values(scope.model.getClusterMemberspecEntities())
                    .filter((spec) => (spec && spec.hasIssues()))
                    .reduce((acc, spec) => (acc.concat(spec.issues)), []));
        };
        scope.getConfigIssues = specEditor.getConfigIssues = () => {
            return scope.model.issues
                .filter((issue) => (issue.group === 'config'))
                .concat(Object.values(scope.model.getClusterMemberspecEntities())
                    .filter((spec) => (spec && spec.hasIssues()))
                    .reduce((acc, spec) => (acc.concat(spec.issues)), []));
        };
        scope.getPoliciesIssues = () => {
            return scope.model.getPoliciesAsArray().reduce((acc, policy) => {
                if (policy.hasIssues()) {
                    acc = acc.concat(policy.issues)
                }
                return acc;
            }, []);
        };
        scope.getEnrichersIssues = () => {
            return scope.model.getEnrichersAsArray().reduce((acc, enricher) => {
                if (enricher.hasIssues()) {
                    acc = acc.concat(enricher.issues)
                }
                return acc;
            }, []);
        };

        scope.getBadgeClass = (issues) => {
            return issues.some(issue => issue.level === ISSUE_LEVEL.ERROR) ? 'badge-danger' : 'badge-warning';
        };

        specEditor.descriptionHtml = (text) => {
            let out = [];
            for (let item of text.split(/\n\n+/)) {
                out.push('<div class="paragraph-spacing"></div>');
                out.push($sanitize(item));
            }
            out.splice(0, 1);
            return $sce.trustAsHtml(out.join("\n"));
        };

        function getConfigWidgetModeInternal(item, val) {
            if (angular.element($document[0].activeElement).hasClass("form-control") && item.widgetMode) {
                // don't switch mode in mid-edit, e.g. if you are manually typing $brooklyn:component("x").config("y")
                // don't interrupt when the user has typed $brooklyn:component("x")!
                return item.widgetMode;
            }

            if (specEditor.isDsl(item.name)) {
                return scope.state.config.dslViewerManualOverride && scope.state.config.dslViewerManualOverride[item.name] ?
                    "dsl-manual" // causes default string editor
                    : "dsl-viewer";
            }

            if (!specEditor.defined(val)) val = scope.config[item.name];
            let type = baseType(item.type);

            // if actual value's type does not match declared type,
            // e.g. object is a map when declared type is object or string or something else,
            // we could render e.g. w map editor as a convenience;
            // but for now the logic is only based on the declared type

            if (type === 'java.lang.Boolean') type = 'boolean';
            else if (type === 'java.util.Map') type = 'map';
            else if (type === 'java.util.Set' || type === 'java.util.List' || type === 'java.util.Collection') type = 'array';

            if (specEditor.defined(val)) {
                // override to use string editor if the editor doesn't support the value
                // (probably this is an error, though type-coercion might make it not so)
                if (type === 'boolean') {
                    if (typeof val !== type) return type + '-manual';  // causes default string editor
                } else if (type === 'map') {
                    if (typeof val !== 'object') return type + '-manual';  // causes default string editor
                } else if (type === 'array') {
                    if (!Array.isArray(val)) return type + '-manual';  // causes default string editor
                }
            }
            if (scope.state.config.codeModeActive[item.name]) {
                // code mode forces manual editor
                return type + '-manual';
            }

            return type;
        }
        scope.getConfigWidgetMode = (item, value) => {
            // record the value as `item.widgetMode` so we can reference it subsequently, as well as returning it

            if (item.type) {
                return item.widgetMode = getConfigWidgetModeInternal(item, value);
            }

            // if type isn't set then infer
            if (value instanceof Array) {
                item.widgetMode = 'array';
            } else if (value instanceof Object) {
                item.widgetMode = 'map';
            } else {
                item.widgetMode = 'unknown';
            }
            return item.widgetMode;
        };
        specEditor.getParameterWidgetMode = (item) => {
            let type = item.type || item.typeName;

            if (type === 'java.lang.Boolean') type = 'boolean';
            else if (type === 'java.util.Map') type = 'map';
            else if (type === 'java.util.Set' || type === 'java.util.List' || type === 'java.util.Collection' || type.startsWith('List<')) type = 'array';

            if (type.startsWith('AWS::')) type = 'unknown';

            return type;
        };
        scope.isCodeModeAvailable = (item) => {
            let val = scope.config[item.name];

            if (scope.state.config.codeModeActive[item.name]) {
                // simple check to update whether it is forced when active -- if it starts with { or [
                scope.state.config.codeModeForced[item.name] = (typeof val === 'string' && val.trim().match(/^[{\[]/));
                // always available if user has set it active, and poor-man's forced check above should apply
                return true;
            }
            // else don't force unless the parse confirms it
            scope.state.config.codeModeForced[item.name] = false;
            // otherwise true if the text entered is json
            if (!specEditor.defined(val)) return false;
            if (typeof val == 'string') {
                try {
                    // a YAML parse would be nicer, but JSON is simpler, and sufficient
                    // (esp as we export a JSON stringify; preferable would be to export the exact YAML from model,
                    // including comments, but again lower priority)
                    let parsed = JSON.parse(val);
                    // if parse returns a string or a complex object, then it looks like JSON was entered
                    // (e.g. "foo" or {a:1}); if not, eg user entered boolean or number (45 or true),
                    // then don't offer code mode; if it was complex, additionally force code mode
                    scope.state.config.codeModeForced[item.name] = typeof parsed === 'object' || typeof parsed === 'array';
                    return (scope.state.config.codeModeForced[item.name] || typeof parsed === 'string');
                } catch (ex) {
                    // not valid text input for code mode
                    // if "codeModeForced" with poor-man's check was enabled we should disable that
                    scope.state.config.codeModeForced[item.name] = false;
                    return false;
                }
            }
            if (val instanceof Dsl) return false;
            if (val instanceof Array || val instanceof Object) return true;
            // other primitive
            return false;
        };
        scope.codeModeClick = (item) => {
            if (scope.state.config.codeModeForced[item.name] && scope.state.config.codeModeActive[item.name]) {
                // if forced and active, don't allow clicks
                return;
            }
            let oldMode = !!(scope.state.config.codeModeActive[item.name]);
            // convert local config from json to non-json or vice-versa
            let value = scope.config[item.name];
            if (!specEditor.defined(value)) {
                value = null;
            }
            if (value != null) {
                if (oldMode) {
                    // leaving code mode
                    try {
                        // if it's a parseable string, then parse it
                        if (typeof value === 'string' && value.length) {
                            value = JSON.parse(value);
                            if (value instanceof Array || value instanceof Object) {
                                // if result is not a primitive then don't allow user to leave code mode
                                // (if type is known as a map/list then likely we should allow leaving code mode,
                                // if we check and confirm that all entries are json primitives, but that can be left as a TODO;
                                // only would enter that state if user clicked to enter code for a map/list,
                                // and they can reset by switching to yaml)
                                $log.warn("JSON code is not a primitive; leaving as code mode:", item.name, value);
                                return;
                            }
                            // parsed value is a primitive, make that be the value shown
                        } else {
                            // if type is not a string, then show unchanged value
                            // (would only come here on weird changes)
                            value = null;
                        }
                    } catch (notJson) {
                        // if not parseable then leave alone
                        value = null;
                    }
                } else {
                    // entering code mode
                    try {
                        if (typeof value === 'string') {
                            if (value.length) {
                                JSON.parse(value);
                                // if it parses, treat as a json object
                            } else {
                                // if empty, leave empty
                            }
                        } else {
                            // if not a string then treat as not parseable
                            throw 'not json';
                        }
                    } catch (notJson) {
                        // if not parseable or not a string, then convert to json
                        value = JSON.stringify(value);
                    }
                }
                if (value != null) {
                    scope.config[item.name] = value;
                }
            }
            scope.state.config.codeModeActive[item.name] = !oldMode;
            if (value != null) {
                // local config changed, make sure model is updated too
                setModelFromLocalConfig();
            }
        };
        scope.getJsonModeTitle = (itemName) => {
            if (!scope.state.config.codeModeActive[itemName]) {
                return "Treat this value as a JSON-encoded object [" + itemName + "]";
            }
            if (scope.state.config.codeModeForced[itemName]) {
                return "This data is a complex object and can only be entered as JSON [" + itemName + "]";
            } else {
                return "Edit in simple mode, unwrapping JSON if possible [" + itemName + "]";
            }
        };
        scope.parameterCodeModeClick = (item) => {
            let oldMode = !!(item && scope.state.parameters.codeModeActive[item.name]);
            let value = null;
            if (oldMode) {
                // leaving code mode
                value = scope.state.parameters.edit.json;
                try {
                    value = JSON.parse(value);
                    let i = scope.parameters.findIndex(p => p.name === item.name);
                    scope.parameters[i] = value;
                } catch (notJson) {
                    // if not parseable then leave alone
                    value = null;
                }
            } else {
                // entering code mode
                // leave code mode for other parameter if set
                if (scope.state.parameters.edit.newName && scope.state.parameters.edit.newName!=item.name) {
                    scope.parameterCodeModeClick(getParameter(scope.state.parameters.edit.newName));
                }
                // convert local parameter from json to non-json or vice-versa
                value = item;
                if (value != null) {
                    try {
                        JSON.parse(value);
                    } catch (notJson) {
                        // if not parseable or not a string, then convert to json
                        // (as with other stringify, this loses any comments etc)
                        value = JSON.stringify(value, null, "  ");
                    }
                    if (value != null) {
                        scope.state.parameters.edit.json = value;
                    }
                }
            }
            scope.state.parameters.codeModeActive[item.name] = !oldMode;
            if (value != null) {
                // local parameters changed, make sure model is updated too
                setModelFromLocalParameters();
            }
        };
        /** returns 'enabled' or 'disabled' if a widget is defined, or null if no special widget is defined */
        specEditor.getCustomConfigWidgetMode = (item) => {
            var widgetMetadata = scope.state.config.customConfigWidgetMetadata[item.name];
            if (!widgetMetadata) return null;
            if (widgetMetadata["error"]) {
                return "disabled";
            }
            return widgetMetadata["enabled"] ? 'enabled' : 'disabled';
        };
        specEditor.customConfigWidgetError = (item) => {
            var widgetMetadata = scope.state.config.customConfigWidgetMetadata[item.name];
            if (!widgetMetadata || !widgetMetadata["error"]) return null;
            if (widgetMetadata.manualToggleAfterError && widgetMetadata.enabled) {
                // show the error if manually enabled
                return widgetMetadata["error"];
            }
            return null;
        };
        specEditor.customParameterErrors = (item) => {
            if (scope.state.parameters && scope.state.parameters.edit && scope.state.parameters.edit.item === item && scope.state.parameters.edit.errors) {
                return scope.state.parameters.edit.errors;
            }
            return [];
        };
        specEditor.toggleCustomConfigWidgetMode = (item, newval) => {
            let widgetMetadata = scope.state.config.customConfigWidgetMetadata[item.name];
            if (!widgetMetadata) {
                $log.error('Custom widget mode should not be toggled when not available: ' + item.name);
                return null;
            }
            if (!specEditor.defined(newval)) {
                if (widgetMetadata["error"] && !widgetMetadata.manualToggleAfterError) {
                    widgetMetadata.manualToggleAfterError = true;
                    newval = true;
                } else {
                    newval = !widgetMetadata.enabled;
                }
            }
            widgetMetadata.enabled = newval;
        };
        specEditor.getCustomConfigWidgetModeTitle = (item) => {
            let widgetMetadata = scope.state.config.customConfigWidgetMetadata[item.name];
            if (!widgetMetadata) {
                // shouldn't be visible
                return "(custom widget not available)";
            }
            return widgetMetadata.enabled ? "Use standard widget" : "Use custom widget";
        };
        specEditor.getCustomConfigWidgetTemplate = (item) => {
            let widgetMetadata = scope.state.config.customConfigWidgetMetadata[item.name];
            let widgetName = $sanitize(widgetMetadata.widget || '--no-widget--');
            let templateName = 'custom-config-widget-' + widgetName;
            if (!$templateCache.get(templateName)) {
                let widgetDirective = widgetName.replace(/(-[a-z])/g, function ($1) {
                    return $1[1].toUpperCase();
                }) + 'Directive';
                if ($injector.has(widgetDirective)) {
                    $templateCache.put(templateName, '<' + widgetName + ' item="item" params="state.config.customConfigWidgetMetadata[item.name]" config="config" model="model"/>');
                } else {
                    $log.error('Missing directive ' + widgetDirective + ' for custom widget for ' + item.name + '; falling back to default widget');
                    scope.state.config.customConfigWidgetMetadata[item.name].error = "Missing directive";
                    templateName = "error-" + templateName;
                    $templateCache.put(templateName, '<i>Widget ' + widgetName + ' missing</i>');
                }
            }
            return templateName;
        };
        specEditor.isDsl = (key, index) => {
            let val = scope.model.config.get(key);
            if (specEditor.defined(val) && specEditor.defined(index) && index != null) val = val[index];
            return specEditor.isDslVal(val);
        };
        specEditor.isDslVal = (val) => {
            // don't treat constants as DSL (not helpful, and the DSL editor doesn't support it)
            return (val instanceof Dsl) && val.kind && val.kind.family != 'constant';
        };
        specEditor.isDslWizardButtonAllowed = (key, index, nonModelValue) => {
            let val = scope.model.config.get(key);
            if (specEditor.defined(val) && specEditor.defined(index) && index != null) val = val[index];
            if (!specEditor.defined(val) || val === null || val === '') val = nonModelValue;
            if (!specEditor.defined(val) || val === null || val === '') return true;
            if (specEditor.isDslVal(val)) {
                return true;
            }
            // non-DSL values cannot be opened in DSL editor
            return false;
        };

        function getAddListConfig() {
            if (!angular.isArray(scope.model.miscData.get('config'))) {
                return [];
            }
            let filteredConfig = $filter('specEditorConfig')(scope.model.miscData.get('config'), scope.state.config.filter.values, scope.model);
            return scope.model.miscData.get('config').map((config) => {
                config.isHidden = scope.model.miscData.get('config').indexOf(config) > -1 ? filteredConfig.indexOf(config) === -1 : false;
                return config;
            });
        }

        function loadCustomConfigWidgetMetadata(model) {
            let customConfigWidgets = (scope.model.miscData.get('ui-composer-hints') || {})['config-widgets'] || [];
            customConfigWidgets.forEach((wd) => {
                let keys = wd.keys || [wd.key];
                keys.forEach((k) => {
                    scope.state.config.customConfigWidgetMetadata[k] = angular.extend({enabled: true}, scope.state.config.customConfigWidgetMetadata[k], wd);
                });
            });
        }

        /**
         * The configuration data for each item is stored in multiple places:
         *
         * scope.config
         *   A map of values used/set by editor, which can be strings, a map of strings, the JSON representation of the
         *   object if using code mode, etc. This should be suitable for ng-model to work with, so e.g. if using code
         *   mode we need to put JSON.stringify value in here, and note any change here immediately (on next digest)
         *   updates scope.model.config, which e.g. in code mode will JSON.parse
         *
         * scope.model.config
         *   A map of values used in internal model
         *
         * scope.model.miscData.get('config')
         *   A list of config keys with their metadata, including derived widgetMode
         *
         * scope.state.config.{codeModeActive,dslManualOverride}
         *   Maps of booleans where edit modes are set and remembered for configs
         */

        function loadLocalConfigFromModel() {
            let modelConfig = scope.model.config;
            let result = {};
            for (let [key, value] of modelConfig) {
                if (blueprintService.isReservedKey(key)) {
                    continue; // skip
                }
                result[key] = getLocalConfigValueFromModelValue(key, value);
            }
            scope.config = result;
        }

        function getLocalConfigValueFromModelValue(key, value) {
            if (!specEditor.defined(value) || value == null) {
                return value;
            }

            if (ANY_MEMBERSPEC_REGEX.test(key) && value.hasOwnProperty(DSL_ENTITY_SPEC)) {
                let wrapper = {};
                wrapper[REPLACED_DSL_ENTITYSPEC] = value[DSL_ENTITY_SPEC];
                return wrapper;
            }
            if (value instanceof Dsl) {
                return value.toString();
            }

            let definition = scope.model.miscData.get('config').find(config => config.name === key);
            if (!definition) {
                definition = {};
                scope.getConfigWidgetMode(definition, value)
            } else {
                if (!definition.widgetMode) scope.getConfigWidgetMode(definition);
            }

            // if json mode, then just stringify
            if (scope.state.config.codeModeActive[key]) {
                if (scope.state.config.codeModeError[key]) {
                    // errors don't get stringified because model value was not parsed
                    return value;
                }
                // if current local value gives same result then don't change it
                // (don't interrupt user's flow, and respect their spacing, at least until
                // they click away; ultimately we would like access to the parse tree,
                // so we could take the text as entered exactly (maybe stripping initial whitespace),
                // also supporting yaml and comments, but that is a bigger task!)
                if (scope.config && typeof scope.config[key] === 'string') {
                    try {
                        if (JSON.stringify(JSON.parse(scope.config[key])) === JSON.stringify(value)) {
                            return scope.config[key];
                        }
                    } catch (ignoredError) {
                        $log.debug("Couldn't handle entered JSON", scope.config[key], ignoredError);
                    }
                }
                // otherwise pretty print it, so they get decent multiline on first load and
                // if they click off the entity then back on to the entity and this field
                // (we'd like to respect what they actually typed but that needs the parse tree, as above)
                return JSON.stringify(value, null, "  ");
            }

            // else treat as value, with array/map special

            try {
                if (definition.widgetMode === 'array') {
                    return value.map(item => {
                        if (item instanceof Dsl) {
                            return item.toString();
                        } else if (item instanceof Array || item instanceof Object) {
                            throw 'not simple json in array';
                        } else {
                            return item;
                        }
                    });
                } else if (definition.widgetMode === 'map') {
                    let object = {};
                    for (let keyObject in value) {
                        if (value[keyObject] instanceof Dsl) {
                            object[keyObject] = value[keyObject].toString();
                        } else if (value[keyObject] instanceof Array || value[keyObject] instanceof Object) {
                            throw 'not simple json in map';
                        } else {
                            object[keyObject] = value[keyObject];
                        }
                    }
                    return object;
                } else if (!(value instanceof Dsl) && (value instanceof Object || value instanceof Array)) {
                    throw 'must use code editor';
                }
            } catch (hasComplexJson) {
                // any map/array with complex json inside, or other value of complex json,
                // will force the code editor
                // (previously we did stringify on entries then tried to parse, but that was inconsistent)
                scope.state.config.codeModeActive[key] = true;
                // and the widget mode updated to be 'manual'
                scope.getConfigWidgetMode(definition, value);
                // and rerun this method so we get it prettified if appropriate
                return getLocalConfigValueFromModelValue(key, value);
            }

            // if boolean, return as primitive type
            if (typeof value === 'boolean') {
                return value;
            }

            // all other primitives treat as string (as they will get a string-based widget)
            return "" + value;
        }

        function getModelValueFromString(val) {
            if (!specEditor.defined(val) || val == null || typeof val !== 'string') {
                // only strings will have primitive inference applied
                // (and this is only invoked when not in code mode)
                return val;
            }
            try {
                let prim = JSON.parse(val);
                if (prim instanceof Object || prim instanceof Array || typeof prim === 'string') {
                    throw 'not primitive';
                }
                if (val.match(/^[0-9]*\.([0-9]*0)?$/)) {
                    // if user enters "3.0" or "1." we should treat it as a string to prevent
                    // yaml editor from simplifying it to be "3" or "1".
                    throw 'decimal ending with dot or 0, eg version, treat as string';
                }
                // numbers and booleans are unquoted
                return prim;
            } catch (ex) {
                return val;
            }
        }

        function setModelFromLocalConfig() {
            let localConfig = scope.config;
            let result = {};
            for (let keyRef in localConfig) {
                if (angular.isUndefined(localConfig[keyRef]) || localConfig[keyRef] === null || localConfig[keyRef].length < 1) {
                    continue;
                }
                if (ANY_MEMBERSPEC_REGEX.test(keyRef) && localConfig[keyRef].hasOwnProperty(REPLACED_DSL_ENTITYSPEC)) {
                    result[keyRef] = {};
                    result[keyRef][DSL_ENTITY_SPEC] = localConfig[keyRef][REPLACED_DSL_ENTITYSPEC];
                    continue;
                }

                let definition = scope.model.miscData.get('config').find(config => config.name === keyRef);
                if (!definition) {
                    definition = {};
                    scope.getConfigWidgetMode(definition, localConfig[keyRef])
                }

                // if JSON mode then parse
                scope.state.config.codeModeError[keyRef] = null;
                if (scope.state.config.codeModeActive && scope.state.config.codeModeActive[keyRef]) {
                    try {
                        result[keyRef] = JSON.parse(localConfig[keyRef]);
                    } catch (ex) {
                        scope.state.config.codeModeError[keyRef] = "Invalid JSON";
                        result[keyRef] = localConfig[keyRef];
                    }
                    continue;
                }

                // else return as is, or introspect for array/map

                if (definition.widgetMode === 'array') {
                    result[keyRef] = localConfig[keyRef].map(getModelValueFromString);
                    continue;
                }
                if (definition.widgetMode === 'map') {
                    result[keyRef] = {};
                    for (let keyObject in localConfig[keyRef]) {
                        result[keyRef][keyObject] = getModelValueFromString(localConfig[keyRef][keyObject]);
                    }
                    continue;
                }

                result[keyRef] = getModelValueFromString(localConfig[keyRef]);
            }

            scope.model.setConfigFromJson(result);
        }

        function addConfigKey() {
            let name = scope.state.config.add.value;
            if (name) {
                let allConfig = scope.model.miscData.get('config');
                blueprintService.addConfigKeyDefinition(allConfig, name);
                scope.model.addConfig(name, '');
                loadLocalConfigFromModel();
                scope.state.config.add.value = '';
                scope.state.config.add.open = false;
                scope.state.config.filter.values[CONFIG_FILTERS[CONFIG_FILTERS.length - 1].id] = true;
                scope.state.config.focus = name;
            }
        }

        function refreshCustomValidation(model) {
            model.config.forEach((value, key) => {
                let config = model.miscData.get('config').find(config => config.name === key);
                // Ideally code below would escaped or use template/directive; sanitize just catches attacks.
                // (These values are automatically sanitized in any case, so that's redundant.)

                // If we need an integer, check if the value is a number
                if (config.type === 'java.lang.Integer' && !angular.isNumber(value) && !(value instanceof Dsl)) {
                    model.addIssue(Issue.builder().group('config').ref(key).message('<code>' + $sanitize(value) + '</code> is not a number').build());
                }
                if (scope.state.config.codeModeError[key]) {
                    model.addIssue(Issue.builder().group('config').ref(key).message('<code>' + $sanitize(value) + '</code> is not valid JSON').build());
                }
            });
        }

        /**
         * The parameter data for each item is stored in multiple places, similar to configuration data:
         *
         * scope.parameters
         *   An array of values used/set by editor
         *
         * scope.model.parameters
         *   An array of values used in internal model
         *
         * scope.state.parameters.codeModeActive
         *   A map of booleans indicating whether to edit the parameter definition as JSON
         */

        function loadLocalParametersFromModel() {
            let modelParams = scope.model.parameters;
            let result = [];
            for (let paramRef of modelParams) {
                if (blueprintService.isReservedKey(paramRef.name)) {
                    continue; // skip
                }
                result.push(paramRef);
            }
            scope.parameters = result;
        }

        function getParameter(name) {
            return scope.parameters.find(p => p.name === name);
        }

        function checkNameChange(oldName, newName) {
            if (!oldName) {
                return true;
            }
            if (oldName && oldName!=newName) {
                scope.state.parameters.codeModeActive[newName] = scope.state.parameters.codeModeActive[oldName];
                scope.state.parameters.codeModeError[newName] = scope.state.parameters.codeModeError[oldName]; 
                delete scope.state.parameters.codeModeActive[oldName]; 
                delete scope.state.parameters.codeModeError[oldName];
                return true;
            }
            return false;            
        }
        function setModelFromLocalParameters() {
            if (scope.state.parameters && scope.state.parameters.edit && scope.state.parameters.edit.item) {
                let item = scope.state.parameters.edit.item;
                scope.state.parameters.edit.errors = [];
                if (scope.state.parameters.codeModeActive[item.name]) {
                    try {
                        let parsed = JSON.parse(scope.state.parameters.edit.json);
                        checkNameChange(item.name, parsed.name);
                        if (JSON.stringify(item)==JSON.stringify(parsed)) {
                            // no change; don't change else we get a digest cycle
                        } else {
                            Object.keys(item).forEach((k) => delete item[k]);
                            Object.assign(item, parsed);
                        }
                        
                    } catch (e) {
                        // $log.warn("ERROR parsing json", scope.state.parameters.edit.json, e);
                        scope.state.parameters.edit.errors.push({ message: "Invalid JSON for parameter" });
                    }
                    
                } else {
                    if (scope.state.parameters.edit.newName) {
                        if (checkNameChange(item.name, scope.state.parameters.edit.newName)) {
                            item.name = scope.state.parameters.edit.newName;
                        }
                    } else {
                        scope.state.parameters.edit.errors.push({ message: "Name must not be blank" });
                    }
                     
                    try {
                        item.constraints = JSON.parse(scope.state.parameters.edit.constraints);
                    } catch (e) {
                        // $log.warn("ERROR parsing constraints", scope.state.parameters.edit.constraints, e);
                        scope.state.parameters.edit.errors.push({ message: "Invalid constraint JSON" });
                    }
                }
            }
            
            let localParams = scope.parameters;
            let result = [];
            for (let paramRef of localParams) {
                if (angular.isUndefined(paramRef) || paramRef === null || paramRef.length < 1) {
                    continue;
                }
                result.push(paramRef);
            }
            scope.model.setParametersFromJson(result);
        }

        function addParameter(name) {
            let allParams = scope.model.miscData.get('parameters');
            blueprintService.addParameterDefinition(allParams, name);
            let param = allParams.find(p => p.name === name);
            scope.model.addParameter(param);
            loadLocalParametersFromModel();
            scope.state.parameters.add.value = '';
            scope.state.parameters.add.open = false;
            scope.state.parameters.focus = name;
        }

        function removeParameter(name) {
            scope.model.removeParameter(name);
            loadLocalParametersFromModel();
            if (scope.state.parameters.focus === name) {
                scope.state.parameters.focus = '';
            }
        }
    }
}

export function specEditorConfigFilter() {
    return function (input, filtersMapById, model) {
        let filters = [];
        Object.keys(filtersMapById).forEach( (k) => { if (filtersMapById[k]) filters.push(k); } );

        if (!filters.every(filterId => CONFIG_FILTERS.some(filter => filter.id === filterId))) {
            return input;
        }
        if (!(input instanceof Array)) {
            return input;
        }
        return input.filter((item)=> {
            return filters.some(filterId => CONFIG_FILTERS.find(filter => filter.id === filterId).filter(item, model));
        });
    }
}

export function specEditorTypeFilter() {
    return function (input, search) {
        if (search.length < 1) {
            return input;
        }
        return input.filter((item)=> {
            return item.miscData.get('typeName').indexOf(search) > -1 || item.type.indexOf(search) > -1;
        });
    }
}

function templateCache($templateCache) {
    $templateCache.put(TEMPLATE_URL, template);
}
