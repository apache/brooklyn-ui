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
import {EntityFamily} from '../util/model/entity.model';
import {Dsl} from '../util/model/dsl.model';
import {Issue, ISSUE_LEVEL} from '../util/model/issue.model';
import {RESERVED_KEYS, DSL_ENTITY_SPEC} from '../providers/blueprint-service.provider';
import brooklynDslEditor from '../dsl-editor/dsl-editor';
import brooklynDslViewer from '../dsl-viewer/dsl-viewer';
import template from './spec-editor.template.html';

const MODULE_NAME = 'brooklyn.components.spec-editor';
const ANY_MEMBERSPEC_REGEX = /(^.*[m,M]ember[s,S]pec$)/;
const REPLACED_DSL_ENTITYSPEC = '___brooklyn:entitySpec';

angular.module(MODULE_NAME, [onEnter, autoGrow, blurOnEnter, brooklynDslEditor, brooklynDslViewer])
    .directive('specEditor', ['$rootScope', '$templateCache', '$injector', '$sanitize', '$filter', '$log', '$sce', '$timeout', '$document', 'blueprintService', specEditorDirective])
    .filter('specEditorConfig', specEditorConfigFilter)
    .filter('specEditorType', specEditorTypeFilter);

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
        filter: (item)=> {
            return item.constraints && item.constraints.required;
        }
    },
    {
        id: 'inuse',
        label: 'In Use',
        filter: (item, currentConfig)=> {
            return currentConfig.has(item.name);
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

export function specEditorDirective($rootScope, $templateCache, $injector, $sanitize, $filter, $log, $sce, $timeout, $document, blueprintService) {
    return {
        restrict: 'E',
        scope: {
            model: '='
        },
        template: template,
        link: link
    };

    function link(scope) {
        scope.addConfigKey = addConfigKey;
        scope.FAMILIES = EntityFamily;
        scope.RESERVED_KEYS = RESERVED_KEYS;
        scope.REPLACED_DSL_ENTITYSPEC = REPLACED_DSL_ENTITYSPEC;
        
        let defaultState = {
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
                customConfigWidgetMetadata: { 
                    "defaultDisplayName": { enabled: true, widget: "known-widget-missing" }, 
                    "download.url": { enabled: true, widget: "suggestion-dropdown" }, 
                },
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

        scope.filters = {
            config: CONFIG_FILTERS
        };
        scope.isFilterDisabled = (filter) => filter.id!='all' && scope.state.config.filter.values['all'];
        scope.onFilterClicked = (filter) => {
            if (!scope.isFilterDisabled(filter)) scope.state.config.filter.values[ filter.id ] = !scope.state.config.filter.values[ filter.id ];
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
        scope.$watch('state.config.filter.values', ()=> {
            scope.state.config.add.list = getAddListConfig();
        });

        loadCustomConfigWidgetMetadata(scope);
        
        scope.config = {};
        scope.$watch('model', (newVal, oldVal)=> {
            if (newVal && !newVal.equals(oldVal)) {
                loadLocalConfigFromModel();
            }
        }, true);

        scope.$watch('model.id', ()=> {
            blueprintService.refreshAllRelationships();
        });

        // Config
        scope.$watch('config', (newVal, oldVal)=> {
            setModelFromLocalConfig();
            scope.model.clearIssues({group: 'config'});
            blueprintService.refreshRelationships(scope.model).then(() => {
                return blueprintService.refreshConfigConstraints(scope.model);
            }).then(() => {
                refreshCustomValidation(scope.model);
            });
        }, true);

        scope.getObjectSize = (object)=> {
            return scope.defined(object) && object!=null ? Object.keys(object).length : 0;
        };
        function findNext(element, clazz, stopClazz) {
            let el = element, last = null;
            while (last!=el) {
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
            while (last!=el) {
                last = el;
                if (el.children().length) {
                    // this still does children first, not ideal but okay for how we use it
                    el = angular.element(el.children()[el.children().length-1]);
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
            while (last!=el) {
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
        scope.defined = (o) => (typeof o !== 'undefined');
        scope.advanceOutToFormGroupInPanel = (element, event) => {
            focusIfPossible(event, findAncestor(element, "form-group", "panel-body")) || element[0].blur(); 
        };
        scope.advanceControlInFormGroup = (element, event) => {
            focusIfPossible(event, findNext(element, "form-control", "form-group")) ||
                scope.advanceOutToFormGroupInPanel(element, event);
        };
        
        scope.onAddMapProperty = (configKey, key, ev)=> {
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
                            scope.advanceOutToFormGroupInPanel(element, null);
                    }, 0);
                } else {
                    // user entered a key that already exists;
                    // would be nice to select the item they requested but with just jqlite that's more pain than it's worth!
                }
            }
        };
        scope.cycleExpandMode = function (expandMode, ctx, item, focus) {
            return expandMode == 'default' ? 'open' :
                expandMode == 'open' ? 'closed' :
                'default';
        }
        scope.onDeleteMapProperty = function (model, key) {
            if (model && model.hasOwnProperty(key)) {
                delete model[key];
            }
        };
        scope.onAddListItem = (configKey, item, ev)=> {
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
        scope.onDeleteListItem = function (model, index) {
            if (model && index < model.length) {
                model.splice(index, 1);
            }
        };
        scope.isConfigHidden = (config)=> {
            let allConfig = scope.model.miscData.get('config');
            if (allConfig.indexOf(config) === -1) {
                return false;
            }
            return $filter('specEditorConfig')(allConfig, scope.state.config.filter.values).indexOf(config) === -1;
        };
        scope.onFocusOnConfig = ($item)=> {
            scope.state.config.search = '';
            scope.state.config.add.value = '';
            scope.state.config.add.open = false;
            scope.state.config.focus = $item.name;
            if ($item.isHidden) {
                scope.state.config.filter.values[ CONFIG_FILTERS[CONFIG_FILTERS.length - 1] ].id = true;
            }
        };
        scope.recordFocus = ($item)=> {
            scope.state.config.focus = $item.name;
        };

        scope.removeAdjunct = ($event, adjunct)=> {
            $event.preventDefault();
            $event.stopPropagation();
            switch(adjunct.family) {
                case EntityFamily.POLICY:
                    scope.model.removePolicy(adjunct._id);
                    break;
                case EntityFamily.ENRICHER:
                    scope.model.removeEnricher(adjunct._id);
                    break;
            }
        };

        scope.removeEntity = ()=> {
            $rootScope.$broadcast('d3.remove', scope.model);
        };

        scope.getConfigIssues = ()=> {
            return scope.model.issues
                .filter((issue)=>(issue.group === 'config'))
                .concat(Object.values(scope.model.getClusterMemberspecEntities())
                    .filter((spec)=>(spec && spec.hasIssues()))
                    .reduce((acc, spec)=>(acc.concat(spec.issues)), []));
        };

        scope.getPoliciesIssues = ()=> {
            return scope.model.getPoliciesAsArray().reduce((acc, policy)=> {
                if (policy.hasIssues()) {
                    acc = acc.concat(policy.issues)
                }
                return acc;
            }, []);
        };

        scope.getEnrichersIssues = ()=> {
            return scope.model.getEnrichersAsArray().reduce((acc, enricher)=> {
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
            
            if (scope.isDsl(item.name)) {
                return scope.state.config.dslViewerManualOverride && scope.state.config.dslViewerManualOverride[item.name] ? 
                    "dsl-manual" // causes default string editor
                    : "dsl-viewer"; 
            }
            
            if (!scope.defined(val)) val = scope.config[item.name];
            let type = item.type;
            
            // if actual value's type does not match declared type,
            // e.g. object is a map when declared type is object or string or something else,
            // we could render e.g. w map editor as a convenience;
            // but for now the logic is only based on the declared type
            
            if (type === 'java.lang.Boolean') type = 'boolean';
            else if (type === 'java.util.Map') type = 'map';
            else if (type === 'java.util.Set' || type === 'java.util.List' || type === 'java.util.Collection') type = 'array';
            
            if (scope.defined(val)) {
                // override to use string editor if the editor doesn't support the value
                // (probably this is an error, though type-coercion might make it not so)
                if (type === 'boolean') { 
                    if (typeof val !== type) return type+'-manual';  // causes default string editor
                } else if (type === 'map') {
                    if (typeof val !== 'object') return type+'-manual';  // causes default string editor
                } else if (type === 'array') {
                    if (!Array.isArray(val)) return type+'-manual';  // causes default string editor
                }
            }
            if (scope.state.config.codeModeActive[item.name]) {
                // code mode forces manual editor
                return type+'-manual';
            }
            
            return type;
        };
        scope.getConfigWidgetMode = (item, value) => {
            // record the value as `item.widgetMode` so we can reference it subsequently, as well as returning it
            
            if (item.type) {
                return item.widgetMode = getConfigWidgetModeInternal(item, value);
            }
            
            // if type isn't set then infer
            if (value instanceof Array) {
                definition.widgetMode = 'array';
            } else if (value instanceof Object) {
                definition.widgetMode = 'map';
            } else {
                definition.widgetMode = 'unknown';
            }
        }
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
            if (!scope.defined(val)) return false;
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
        }
        scope.codeModeClick = (item) => {
            if (scope.state.config.codeModeForced[item.name] && scope.state.config.codeModeActive[item.name]) {
                // if forced and active, don't allow clicks
                return;
            }
            let oldMode = !!(scope.state.config.codeModeActive[item.name]);
            // convert local config from json to non-json or vice-versa
            let value = scope.config[item.name];
            if (!scope.defined(value)) {
                value = null;
            }
            if (value!=null) {
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
                if (value!=null) {
                    scope.config[item.name] = value;
                }
            }
            scope.state.config.codeModeActive[item.name] = !oldMode;
            if (value!=null) {
                // local config changed, make sure model is updated too
                setModelFromLocalConfig();
            }
        };
        scope.getJsonModeTitle = (itemName) => {
            if (!scope.state.config.codeModeActive[itemName]) {
                return "Treat this value as a JSON-encoded object ["+itemName+"]";
            }
            if (scope.state.config.codeModeForced[itemName]) {
                return "This data is a complex object and can only be entered as JSON ["+itemName+"]";
            } else {
                return "Edit in simple mode, unwrapping JSON if possible ["+itemName+"]";
            }
        };
        /** returns 'enabled' or 'disabled' if a widget is defined, or null if no special widget is defined */ 
        scope.getCustomConfigWidgetMode = (item) => {
            var widgetMetadata = scope.state.config.customConfigWidgetMetadata[item.name];
            if (!widgetMetadata || widgetMetadata["error"]) return null;
            return widgetMetadata["enabled"] ? 'enabled' : 'disabled';
        };
        scope.toggleCustomConfigWidgetMode = (item, newval) => {
            var widgetMetadata = scope.state.config.customConfigWidgetMetadata[item.name];
            if (!widgetMetadata) {
                $log.error('Custom widget mode should not be toggled when not available: '+item.name);
                return null;
            }
            if (!scope.defined(newval)) newval = !widgetMetadata.enabled;
            widgetMetadata.enabled = newval;
        }
        scope.getCustomConfigWidgetModeTitle = (item) => {
            var widgetMetadata = scope.state.config.customConfigWidgetMetadata[item.name];
            if (!widgetMetadata) {
                // shouldn't be visible
                return "(custom widget not available)";
            }
            return widgetMetadata.enabled ? "Use standard widget" : "Use custom widget";
        };
        scope.copyScopeForCustomConfigWidget = (descendantScope) => {
            descendantScope.toggleCustomConfigWidgetMode = scope.toggleCustomConfigWidgetMode;
            descendantScope.getCustomConfigWidgetModeTitle = scope.getCustomConfigWidgetModeTitle;
            descendantScope.defined = scope.defined;
            descendantScope.config = scope.config;
            descendantScope.state = scope.state;
            descendantScope.copyScopeForCustomConfigWidget = scope.copyScopeForCustomConfigWidget;
        };
        scope.getCustomConfigWidgetTemplate = (item) => {
            var widgetMetadata = scope.state.config.customConfigWidgetMetadata[item.name];
            var widgetName = $sanitize(widgetMetadata.widget || '--no-widget--');
            var templateName = 'custom-config-widget-'+widgetName;
            if (!$templateCache.get(templateName)) {
                var widgetDirective = widgetName.replace(/(-[a-z])/g, function($1){return $1[1].toUpperCase();})+'Directive';
                if ($injector.has(widgetDirective)) {
                    $templateCache.put(templateName, '<'+widgetName+' item="item" params="state.config.customConfigWidgetMetadata[item.name]"/>');
                } else {
                    $log.error('Missing directive '+widgetDirective+' for custom widget for '+item.name+'; falling back to default widget');
                    scope.state.config.customConfigWidgetMetadata[item.name].error = "Missing directive";
                    templateName = "error-" + templateName;
                    $templateCache.put(templateName, '<i>Widget '+widgetName+' missing</i>');
                }
            }
            return templateName;
        };
        
        scope.isDsl = (key, index) => {
            let val = scope.model.config.get(key);
            if (scope.defined(val) && scope.defined(index) && index!=null) val = val[index];
            return scope.isDslVal(val);
        };
        scope.isDslVal = (val) => {
            // don't treat constants as DSL (not helpful, and the DSL editor doesn't support it)
            return (val instanceof Dsl) && val.kind && val.kind.family != 'constant';
        };
        scope.isDslWizardButtonAllowed = (key, index) => {
            let val = scope.model.config.get(key);
            if (scope.defined(val) && scope.defined(index) && index!=null) val = val[index];
            if (!scope.defined(val) || val===null || val==='') return true;
            if (scope.isDslVal(val)) {
                return true;
            }
            // non-DSL values cannot be opened in DSL editor
            return false;
        };
        
        function getAddListConfig() {
            if (!angular.isArray(scope.model.miscData.get('config'))) {
                return [];
            }
            let filteredConfig = $filter('specEditorConfig')(scope.model.miscData.get('config'), scope.state.config.filter.values, scope.model.config);
            return scope.model.miscData.get('config').map((config)=> {
                config.isHidden = scope.model.miscData.get('config').indexOf(config) > -1 ? filteredConfig.indexOf(config) === -1 : false;
                return config;
            });
        }

        function loadCustomConfigWidgetMetadata(model) {
            console.log("misc data", model.miscData, scope.model.miscData.get('ui-composer-hints'));
            var customConfigWidgets = (scope.model.miscData.get('ui-composer-hints') || {})['config-widgets'] || [];
            console.log("customs", customConfigWidgets);
            customConfigWidgets.forEach( (wd) => {
                console.log("looking at", wd);
                var keys = wd.keys || [ wd.key ];
                keys.forEach( (k) => {
                    console.log("setting key", k);
                    scope.state.config.customConfigWidgetMetadata[k] = angular.extend({ enabled: true }, scope.state.config.customConfigWidgetMetadata[k], wd);
                });
            });
            console.log("custom config", scope.state.config.customConfigWidgetMetadata);
        }
        
        /* config state for each item is stored in multiple places:
         * * scope.config = map of values used/set by editor (strings, map of strings, json code if using code mode, etc);
         *   this should be suitable for ng-model to work with, so e.g. if using code mode we need to put JSON.stringify value in here,
         *   and note any change here immediately (on next digest) updates scope.model.config, which e.g. in code mode
         *   will JSON.parse
         * * scope.model.config = map of values used in internal model
         * * scope.model.miscData.get('config') = list of config keys with their metadata, including derived widgetMode
         * * scope.state.config.{codeModeActive,dslManualOverride} = maps of booleans where edit modes are set and remembered for configs
         */

        function loadLocalConfigFromModel() {
            let map = scope.model.config;
            let result = {};
            for (let [key, value] of map) {
                if (blueprintService.isReservedKey(key)) {
                    // skip
                    continue;
                }

                result[key] = getLocalConfigValueFromModelValue(key, value);
            }
            scope.config = result;
        }

        function getLocalConfigValueFromModelValue(key, value) {
            if (!scope.defined(value) || value==null) {
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
                // odd, no def'n for this key
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
                return JSON.stringify(value);
            }
            
            // else treat as value, with array/map special
            
            try {
                if (definition.widgetMode === 'array') {
                    return value.map(item => {
                        if (item instanceof Dsl) {
                            return item.toString();
                        } else if (item instanceof Array  || item instanceof Object) {
                            throw 'not simple json in array';
                        } else {
                            return item;
                        }
                    });
                } else if (definition.widgetMode === 'map') {
                    let object = {};
                    for (let keyObject in value) {
                        if (value[keyObject]  instanceof Dsl) {
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
                
                return JSON.stringify(value);
            }
            
            // if boolean, return as primitive type
            if (typeof value === 'boolean') {
                return value;
            }
            
            // all other primitives treat as string (as they will get a string-based widget)
            return ""+value;
        }

        function getModelValueFromString(val) {
            if (!scope.defined(val) || val==null || typeof val !== 'string') {
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
                    // odd, no def'n for this key; infer
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
                scope.state.config.filter.values[ CONFIG_FILTERS[CONFIG_FILTERS.length - 1].id ] = true;
                scope.state.config.focus = name;
            }
        }

        function refreshCustomValidation(model) {
            model.config.forEach((value, key) => {
                let config = model.miscData.get('config').find(config => config.name === key);
                // If we need an integer, check if the value is a number
                if (config.type === 'java.lang.Integer' && !angular.isNumber(value) && !(value instanceof Dsl)) {
                    model.addIssue(Issue.builder().group('config').ref(key).message($sce.trustAsHtml(`<code>${value}</code> is not a number`)).build());
                }
                if (scope.state.config.codeModeError[key]) {
                    model.addIssue(Issue.builder().group('config').ref(key).message($sce.trustAsHtml(`<code>${value}</code> is not valid JSON`)).build());
                }
            });
        }
    }
}

export function specEditorConfigFilter() {
    return function (input, filtersMapById, currentConfig) {
        let filters = [];
        Object.keys(filtersMapById).forEach( (k) => { if (filtersMapById[k]) filters.push(k); } );
        
        if (!filters.every(filterId => CONFIG_FILTERS.some(filter => filter.id === filterId))) {
            return input;
        }
        if (!(input instanceof Array)) {
            return input;
        }
        return input.filter((item)=> {
            return filters.some(filterId => CONFIG_FILTERS.find(filter => filter.id === filterId).filter(item, currentConfig));
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
