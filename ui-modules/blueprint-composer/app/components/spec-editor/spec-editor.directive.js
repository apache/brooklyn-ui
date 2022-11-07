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
import {Entity, EntityFamily, baseType} from '../util/model/entity.model';
import {Dsl} from '../util/model/dsl.model';
import {Issue, ISSUE_LEVEL} from '../util/model/issue.model';
import {RESERVED_KEYS, DSL_ENTITY_SPEC} from '../providers/blueprint-service.provider';
import brooklynDslEditor from '../dsl-editor/dsl-editor';
import brooklynDslViewer from '../dsl-viewer/dsl-viewer';
import template from './spec-editor.template.html';
import {isSensitiveFieldName} from 'brooklyn-ui-utils/sensitive-field/sensitive-field';
import {computeQuickFixesForIssue} from '../quick-fix/quick-fix';
import scriptTagDecorator from 'brooklyn-ui-utils/script-tag-non-overwrite/script-tag-non-overwrite';
import jsYaml from "js-yaml";

const MODULE_NAME = 'brooklyn.components.spec-editor';
const REPLACED_DSL_ENTITYSPEC = '___brooklyn:entitySpec';
const SUBSECTION = {
    CONFIG: 'config',
    PARAMETERS: 'parameters'
}

const CODE_MODE = "YAML";

export const SUBSECTION_TEMPLATE_OTHERS_URL = 'blueprint-composer/component/spec-editor/section-others.html';

angular.module(MODULE_NAME, [onEnter, autoGrow, blurOnEnter, brooklynDslEditor, brooklynDslViewer, scriptTagDecorator])
    .directive('specEditor', ['$rootScope', '$templateCache', '$injector', '$sanitize', '$filter', '$log', '$sce', '$timeout', '$document', '$state', '$compile', 'blueprintService', 'composerOverrides', 'mdHelper', 'catalogApi', specEditorDirective])
    .filter('specEditorConfig', specEditorConfigFilter)
    .filter('specEditorType', specEditorTypeFilter)
    .run(['$templateCache', templateCache]);

const TEMPLATE_URL = 'blueprint-composer/component/spec-editor/spec-editor.template.html';

export default MODULE_NAME;

export const CONFIG_FILTERS = [
    {
        id: 'suggested',
        label: 'Suggested',
        icon: 'plus-circle',
        hoverText: 'Show config keys that are marked as pinned or priority',
        filter: (item)=> {
            return item.pinned && (!item.priority || item.priority > -1);
        }
    },
    {
        id: 'required',
        label: 'Required',
        icon: 'stop-circle',
        hoverText: 'Show config keys that are required or have an issue',
        filter: (item, model)=> {
            return (item.constraints && item.constraints.required) ||
                (model && model.issues && model.issues.some((issue)=>(issue.group === 'config' && issue.ref === item.name)) );
        }
    },
    {
        id: 'inuse',
        label: 'In Use',
        icon: 'check-circle',
        hoverText: 'Show config keys that are in use',
        filter: (item, model)=> {
            return model && model.config && model.config.has(item.name);
        }
    },
    {
        id: 'all',
        label: 'All',
        icon: 'th-list',
        hoverText: 'Show all config keys',
        filter: (item)=> {
            return item;
        }
    }
];

export const PARAM_TYPES = [
    // cut-down list from BasicSpecParameter.ParseYamlInputs
    'string', 'boolean', 'integer', 'double', 'duration', ' port'
];

export function specEditorDirective($rootScope, $templateCache, $injector, $sanitize, $filter, $log, $sce, $timeout, $document, $state, $compile, blueprintService, composerOverrides, mdHelper, catalogApi) {
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
        scope.FAMILIES = EntityFamily;
        scope.RESERVED_KEYS = RESERVED_KEYS;
        scope.REPLACED_DSL_ENTITYSPEC = REPLACED_DSL_ENTITYSPEC;
        scope.parameters = [];
        scope.config = {};

        scope.sections = [
            'blueprint-composer/component/spec-editor/section-header.html',
            'blueprint-composer/component/spec-editor/section-parameters.html',
            'blueprint-composer/component/spec-editor/section-entity-config.html',
            'blueprint-composer/component/spec-editor/section-locations.html',
            'blueprint-composer/component/spec-editor/section-policies.html',
            'blueprint-composer/component/spec-editor/section-enrichers.html',
            SUBSECTION_TEMPLATE_OTHERS_URL,
        ];

        specEditor.descriptionVisible = false;
        specEditor.paramTypes = PARAM_TYPES;

        specEditor.getParameter = getParameter;
        specEditor.addParameter = addParameter;
        specEditor.removeParameter = removeParameter;
        specEditor.setEntityVersion = setEntityVersion;
        specEditor.loadedVersion = () => scope.model.miscData.get('loadedVersion') || 'unknown';

        const defaultState = {
            availableVersions: [],
            selectedVersion: scope.model.version,
            focus: {
                subsection: SUBSECTION.CONFIG,
                name: ''
            },
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

        scope.state = sessionStorage && sessionStorage.getItem(scope.model._id)
            ? JSON.parse(sessionStorage.getItem(scope.model._id))
            : defaultState;

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

        catalogApi.getTypeVersions(scope.model.type)
            .then((versions=[]) => {
                scope.state.availableVersions = versions.map(({ version }) => version);
            })

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

        removeFilterIfAllItemsHidden();

        loadCustomConfigWidgetMetadata(scope);

        // Model
        scope.$watch('model', (newVal, oldVal) => {
            if (newVal && !newVal.equals(oldVal)) {
                scope.modelDescription = mdHelper.analyzeDescription({
                    description: newVal.miscData.get('description'),
                    symbolicName: newVal.miscData.get('symbolicName'),
                    displayName: newVal.miscData.get('displayName'),
                });
                loadLocalConfigFromModel();
                loadLocalParametersFromModel();
            }
        }, true);
        scope.$watch('model.id', () => {
            blueprintService.refreshAllRelationships();

            // Broadcast 'd3.renamed' event, allow downstream to react on this event.
            $rootScope.$broadcast('d3.renamed', scope.model);
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
                return blueprintService.refreshConfigInherited(scope.model);
            }).then(() => {
                refreshCustomValidation(scope.model);
            }).then(() => {
                scope.model.issuesWithFixes = [];
                scope.model.issues.forEach(issue => {
                    // really messy copying the issue to add the fixes, but the easiest way
                    let issueCopy = {
                        ref: issue.ref,
                        group: issue.group,
                        message: issue.message,
                    };
                    let issueWithFixes = Object.assign({}, issueCopy, {
                        quickFixes: {},
                    });
                    computeQuickFixesForIssue(issueCopy, scope.model, blueprintService, issueWithFixes.quickFixes);
                    scope.model.issuesWithFixes.push(issueWithFixes);
                });
            });

        }, true);

        scope.applyQuickFix = (issue, fix) => {
            fix.apply(issue, scope.model);
            blueprintService.refreshBlueprintMetadata();
        }

        scope.getObjectSize = (object) => {
            return specEditor.defined(object) && object !== null ? Object.keys(object).length : 0;
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
        specEditor.isInstance = (x, type) => (typeof x === type);

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
        specEditor.recordFocus = (subsection, name) => {
            scope.state.focus.subsection = subsection;
            scope.state.focus.name = name;
        };
        specEditor.isInFocus = (subsection, name) => {
            return scope.state.focus.subsection === subsection && scope.state.focus.name === name;
        };
        scope.onFocusOnConfig = specEditor.onFocusOnConfig = ($item) => {
            scope.state.config.search = '';
            scope.state.config.add.value = '';
            scope.state.config.add.open = false;
            specEditor.recordFocus(SUBSECTION.CONFIG, $item.name);
            if ($item.isHidden) {
                scope.state.config.filter.values.all = true;
            }
        };
        scope.onFocusOnParameter = specEditor.onFocusOnParameter = ($item) => {
            scope.state.parameters.search = '';
            scope.state.parameters.add.value = '';
            scope.state.parameters.add.open = false;
            specEditor.recordFocus(SUBSECTION.PARAMETERS, $item.name);
        };
        scope.recordConfigFocus = specEditor.recordConfigFocus = ($item) => {
            specEditor.recordFocus(SUBSECTION.CONFIG, $item.name);
        };
        scope.recordParameterFocus = specEditor.recordParameterFocus = ($item) => {
            specEditor.recordFocus(SUBSECTION.PARAMETERS, $item.name);
            scope.state.parameters.edit = {
                item: $item,
                newName: $item.name,
                constraints: $item.constraints ? JSON.stringify($item.constraints) : '',
                original: Object.assign({}, $item),
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
        };

        /**
         * Gets collection of issues filtered by group.
         *
         * @param {String} groupName The group name to filter issues by.
         * @returns {[]} The collection of issues found.
         */
        scope.getIssuesByGroup = (groupName) => {
            return scope.model.issues
                .filter((issue) => (issue.group === groupName))
                .concat(Object.values(scope.model.getClusterMemberspecEntities())
                    .filter((spec) => (spec && spec.hasIssues && spec.hasIssues()))
                    .reduce((acc, spec) => (acc.concat(spec.issues)), []));
        }

        /**
         * @returns {[]} The collection of issues specific to Policies.
         */
        scope.getPoliciesIssues = () => {
            return scope.model.getPoliciesAsArray().reduce((acc, policy) => {
                if (policy.hasIssues()) {
                    acc = acc.concat(policy.issues)
                }
                return acc;
            }, []);
        };

        /**
         * @returns {[]} The collection of issues specific to Enrichers.
         */
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

        function getConfigWidgetModeInternal(item, val) {
            if (angular.element($document[0].activeElement).hasClass("form-control") && item.widgetMode) {
                // don't switch mode in mid-edit, e.g. if you are manually typing $brooklyn:component("x").config("y")
                // don't interrupt when the user has typed $brooklyn:component("x")!
                return item.widgetMode;
            }
            if (scope.state.config.codeModeActive[item.name] && item.widgetMode) {
                if (item.widgetMode.endsWith("-manual")) return item.widgetMode;
                return item.widgetMode+"-manual";
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

            if (type === 'java.lang.String') type = 'string';
            else if (type === 'java.lang.Boolean') type = 'boolean';
            else if (type === 'java.util.Map') type = 'map';
            else if (type === 'java.util.Set' || type === 'java.util.List' || type === 'java.util.Collection') type = 'array';
            else if (type === 'java.lang.Object') type = 'object';

            if (specEditor.defined(val)) {
                if (type === 'object') {
                    // object for anonymous keys; if contains an entity spec, use that editor.
                    // otherwise try as map (but if val is not object will revert in next block to map-manual, meaning string editor)
                    if (val.hasOwnProperty(REPLACED_DSL_ENTITYSPEC)) {
                        type = 'org.apache.brooklyn.api.entity.EntitySpec';
                    } else if (Array.isArray(val)) {
                        type = 'array';
                    } else if (typeof val==='object') {
                        type = 'map';
                    }
                }

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
            let type = item.type || item.typeName || 'string';

            if (type === 'java.lang.Boolean') type = 'boolean';
            else if (type === 'java.util.Map') type = 'map';
            else if (type === 'java.util.Set' || type === 'java.util.List' || type === 'java.util.Collection' || type.startsWith('List<')) type = 'array';

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
            if (typeof val === 'string') {
                try {
                    // a YAML parse would be nicer, but JSON is easier to detect its presence, and sufficient;
                    // for convenience, we allow yaml to be _entered_
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
            if (val.hasOwnProperty(REPLACED_DSL_ENTITYSPEC)) return false;
            // any other object or array allows code mode
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
            if (value !== null) {
                if (oldMode) {
                    // leaving code mode
                    try {
                        // if it's a parseable string, then parse it
                        if (typeof value === 'string' && value.length) {
                            value = parseYamlOrJson(value);
                            var mustUseCodeMode = false;
                            const isComplex = x => x instanceof Array || x instanceof Object || typeof x === 'object';
                            if (value instanceof Array) {
                                const complexEntry = value.find(isComplex);
                                if (complexEntry) {
                                    mustUseCodeMode = true;
                                }
                            } else if (value instanceof Object) {
                                mustUseCodeMode = true;
                            } else if (typeof value === 'object') {
                                for (var k in value) {
                                    if (isComplex(k) || isComplex(value[k])) mustUseCodeMode = true;
                                }
                            }
                            if (mustUseCodeMode) {
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
                        value = toCode(value);
                    }
                }
                if (value !== null) {
                    scope.config[item.name] = value;
                }
            }
            scope.state.config.codeModeActive[item.name] = !oldMode;
            if (value !== null) {
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
                if (value !== null) {
                    try {
                        JSON.parse(value);
                    } catch (notJson) {
                        // if not parseable or not a string, then convert to json
                        // (as with other stringify, this loses any comments etc)
                        value = toCode(value, true);
                    }
                    if (value !== null) {
                        scope.state.parameters.edit.json = value;
                    }
                }
            }
            scope.state.parameters.codeModeActive[item.name] = !oldMode;
            if (value !== null) {
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
        specEditor.isSensitiveField = (item) => {
            // should the field support masking
            return isSensitiveFieldName(item.name);
        };
        specEditor.isHiddenSensitiveField = (item) => {
            // is the field currently in a masked state
            return specEditor.isSensitiveField(item) && !item.isHiddenSensitiveFieldUnmasked;
        };
        specEditor.setSensitiveFieldUnmasked = (item, val) => {
            item.isHiddenSensitiveFieldUnmasked = val;
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
            if (specEditor.defined(val) && specEditor.defined(index) && index !== null) val = val[index];
            return specEditor.isDslVal(val);
        };
        specEditor.isDslVal = (val) => {
            // don't treat constants as DSL (not helpful, and the DSL editor doesn't support it)
            return (val instanceof Dsl) && val.kind && val.kind.family !== 'constant';
        };
        specEditor.isDslWizardButtonAllowed = (key, index, nonModelValue) => {
            let val = scope.model.config.get(key);
            if (specEditor.defined(val) && specEditor.defined(index) && index !== null) val = val[index];
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
        specEditor.getConfig = getConfig;
        function getConfig(name) {
            return scope.model.miscData.get('config').find(p => p.name === name);
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

        function removeFilterIfAllItemsHidden() {
            let filteredItems = getAddListConfig();
            if (filteredItems.length > 0 && filteredItems.filter(item => !item.isHidden).length === 0) {
                scope.state.config.filter.values['all'] = true;
            }
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
                result[key] = getLocalConfigValueFromModelValue(key, value);
            }
            scope.config = result;
        }

        function getLocalConfigValueFromModelValue(key, value) {
            if (!specEditor.defined(value) || value === null) {
                return value;
            }

            if (value.hasOwnProperty(DSL_ENTITY_SPEC)) {
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
                if (!definition.widgetMode) scope.getConfigWidgetMode(definition, value);
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
                        if (JSON.stringify(parseYamlOrJson(scope.config[key])) === JSON.stringify(value)) {
                            return scope.config[key];
                        }
                    } catch (ignoredError) {
                        $log.debug("Couldn't handle entered JSON", scope.config[key], ignoredError);
                    }
                }
                // otherwise pretty print it, so they get decent multiline on first load and
                // if they click off the entity then back on to the entity and this field
                // (we'd like to respect what they actually typed but that needs the parse tree, as above)
                return toCode(value, true);
            }

            // else treat as value, with array/map special

            try {
                if (definition.widgetMode === 'array' || definition.widgetMode === 'array-manual') {
                    if (Array.isArray(value)) {
                        return value.map(item => {
                            if (item instanceof Dsl) {
                                return item.toString();
                            } else if (item instanceof Array || item instanceof Object || typeof item === 'object') {
                                throw 'not simple json in array';
                            } else {
                                return item;
                            }
                        });
                    }
                    // fall through to return toString below
                } else if (definition.widgetMode === 'map' || definition.widgetMode === 'map-manual') {
                    if (typeof value === "object") {
                        let object = {};
                        for (let keyObject in value) {
                            if (value[keyObject] instanceof Dsl) {
                                object[keyObject] = value[keyObject].toString();
                            } else if (value[keyObject] instanceof Array || value[keyObject] instanceof Object || typeof value[keyObject] === 'object') {
                                throw 'not simple json in map';
                            } else {
                                object[keyObject] = value[keyObject];
                            }
                        }
                        return object;
                    }
                    // fall through to return toString below
                } else if ((value instanceof Object || value instanceof Array || typeof value === 'object') && !(value instanceof Dsl)) {
                    throw 'must use code editor for array/object';
                }
            } catch (hasComplexJson) {
                // any map/array with complex json inside, or other value of complex json,
                // will force the code editor
                // (previously we did stringify on entries then tried to parse, but that was inconsistent)
                console.log("Forcing code mode on ", key, "=", value, "because", hasComplexJson);

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
            if (!specEditor.defined(val) || val === null || typeof val !== 'string') {
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
                    // TODO if we wanted to support explicit empty strings or null, this would be the place to tweak it,
                    // plus a few other guards on null, and forcing code mode.
                    continue;
                }

                if (localConfig[keyRef].hasOwnProperty(REPLACED_DSL_ENTITYSPEC)) {
                    result[keyRef] = {};
                    result[keyRef][DSL_ENTITY_SPEC] = localConfig[keyRef][REPLACED_DSL_ENTITYSPEC];
                    continue;
                }

                let definition = scope.model.miscData.get('config').find(config => config.name === keyRef);
                if (!definition) {
                    definition = {};
                    scope.getConfigWidgetMode(definition, localConfig[keyRef])
                }

                let v = localConfig[keyRef];

                // if JSON mode then parse
                scope.state.config.codeModeError[keyRef] = null;
                if (scope.state.config.codeModeActive && scope.state.config.codeModeActive[keyRef]) {
                    // first try a yaml parse
                    try {
                        result[keyRef] = parseYamlOrJson(v);
                        continue;
                    } catch (ex) {
                        scope.state.config.codeModeError[keyRef] = "Invalid JSON";
                        result[keyRef] = localConfig[keyRef];
                        continue;
                    }
                }

                // else return as is, or introspect for array/map

                if (definition.widgetMode === 'array') {
                    if (Array.isArray(v)) {
                        result[keyRef] = v.map(getModelValueFromString);
                        continue;
                    }
                }
                if (definition.widgetMode === 'map') {
                    if (typeof v === "object") {
                        result[keyRef] = {};
                        for (let keyObject in v) {
                            result[keyRef][keyObject] = getModelValueFromString(v[keyObject]);
                        }
                        continue;
                    }
                }

                result[keyRef] = getModelValueFromString(v);
            }

            scope.model.setConfigFromJson(result);
        }

        specEditor.addConfigKey = addConfigKey;
        function addConfigKey(name) {
            if (name) {
                blueprintService.addConfigKeyDefinition(scope.model, name);
                scope.model.addConfig(name, '');
                loadLocalConfigFromModel();
                scope.state.config.add.value = '';
                scope.state.config.add.open = false;
                scope.state.config.filter.values[CONFIG_FILTERS[CONFIG_FILTERS.length - 1].id] = true;
                specEditor.recordFocus(SUBSECTION.CONFIG, name)
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
                    model.addIssue(Issue.builder().group('config').ref(key).message('Content is not valid '+(CODE_MODE)).build());
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
            let dups = {};
            for (let paramRef of modelParams) {
                if (dups[paramRef.name]) {
                    var i=2;
                    while (dups[paramRef.name+''+i]) i++;
                    // users won't see this message (unless they have the console open) so it might be surprising
                    // but other behaviours (like the UI breaking) are worse, and not sure of a simple better way to handle
                    $log.warn("Duplicate parameter '"+paramRef.name+"' found; changing to '"+paramRef.name+''+i+"'");
                    paramRef.name = paramRef.name+''+i;
                }
                dups[paramRef.name] = true;
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
            if (oldName && oldName!==newName) {
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
                        let parsed = parseYamlOrJson(scope.state.parameters.edit.json);
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
                        if (blueprintService.isReservedKey(scope.state.parameters.edit.newName)) {
                            scope.state.parameters.edit.errors.push({ message: "Illegal key name" });
                        } else if (checkNameChange(item.name, scope.state.parameters.edit.newName)) {
                            item.oldName = item.name; // Parameter name change.
                            item.name = scope.state.parameters.edit.newName;
                        }
                    } else {
                        scope.state.parameters.edit.errors.push({ message: "Key name must not be blank" });
                    }

                    try {
                        let c = scope.state.parameters.edit.constraints ? JSON.parse(scope.state.parameters.edit.constraints) : [];
                        if (Array.isArray(c)) {
                            if (c.length==0) {
                                delete item['constraints'];
                            } else {
                                item.constraints = c;
                            }
                        } else {
                            scope.state.parameters.edit.errors.push({ message: "Constraint JSON must be a list" });
                        }
                    } catch (e) {
                        $log.warn("ERROR parsing constraints", scope.state.parameters.edit.constraints, e);
                        scope.state.parameters.edit.errors.push({ message: "Invalid constraint JSON" });
                    }

                    // empty values are removed
                    if (item.description === '') {
                        delete item['description'];
                    }
                    if (item.label === '') {
                        delete item['label'];
                    }
                    if (item.default === '') {
                        if (scope.state.parameters.edit.original.default!=='') {
                            // don't delete if default was explicitly set in yaml as "";
                            // this allows empty string defaults to be used (although you can't set them in the visual ui)
                            delete item['default'];
                        }
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
            scope.model.addParameterDefinition(name);
            loadLocalParametersFromModel();
            scope.state.parameters.search = '';
            scope.state.parameters.add.value = '';
            scope.state.parameters.add.open = false;
            specEditor.recordFocus(SUBSECTION.PARAMETERS, name)
        }

        function removeParameter(name) {
            scope.model.removeParameter(name);
            loadLocalParametersFromModel();
            if (specEditor.isInFocus(SUBSECTION.PARAMETERS, name)) {
                specEditor.recordFocus(SUBSECTION.PARAMETERS, '');
            }
            blueprintService.refreshBlueprintMetadata(scope.model);
        }

        function setEntityVersion(version) {
            if (version === scope.model.version) {
                return;
            }

            scope.state.selectedVersion = version;
            scope.model.version = version;

            catalogApi.getType(scope.model.type, scope.model.version)
                .then((catalogItem) => {
                    scope.model.clearConfig();
                    blueprintService.populateEntityFromApi(scope.model, catalogItem);
                    $rootScope.$broadcast('d3.redraw');
                });
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

/**
 * Configures $templateCache for this directive.
 *
 * @param $templateCache The template cache to configure.
 */
function templateCache($templateCache) {
    $templateCache.put(TEMPLATE_URL, template);
}

function parseYamlOrJson(v) {
    // YAML mode experimental; if not working switch back to JSON
    let error = null;
    if (CODE_MODE=="YAML") {
        try {
            return jsYaml.safeLoad(v);
        } catch (ex) {
            error = ex;
        }
    }
    try {
        return JSON.parse(v);
    } catch (ex) {
        if (CODE_MODE=="YAML" && error) throw error;
        throw ex;
    }
}

function toCode(obj, pretty) {
    if (CODE_MODE=="YAML") return jsYaml.dump(obj).trim();
    return pretty ? JSON.stringify(obj, null, "  ") : JSON.stringify(obj);
}
