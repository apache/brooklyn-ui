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
import template from './dsl-viewer.template.html';
import {KIND, FAMILY} from '../util/model/dsl.model';

const MODULE_NAME = 'brooklyn.components.dsl-viewer';
const TEMPLATE_URL = 'blueprint-composer/component/dsl-viewer/index.html';

angular.module(MODULE_NAME, [])
    .directive('dslViewer', ['$log', dslViewerDirective])
    .run(['$templateCache', templateCache]);

export default MODULE_NAME;

export function dslViewerDirective($log) {
    return {
        restrict: 'E',
        templateUrl: function (tElement, tAttrs) {
            return tAttrs.templateUrl || TEMPLATE_URL;
        },
        scope: {
            dsl: '<'
        },
        link: link
    };

    function link(scope) {
        
        function getIconForFunction(dsl) {
            if (dsl.name === 'config') return 'fa-cog';
            if (dsl.name === 'sensor') return 'fa-rss';
            if (dsl.name === 'attributeWhenReady') return 'fa-pause';
            if (dsl.name === 'literal') return 'fa-clone';
            if (dsl.name === 'formatString') return 'fa-qrcode';
            // catch-all
            $log.warn("unexpected DSL function, using default icon", dsl, dsl.name); 
            return 'fa-bolt';
        };
        
        function updateModeAndIcon(dsl) {
            var fam = dsl.kind && dsl.kind.family;
            if (fam === FAMILY.FUNCTION) {
                switch (dsl.kind) {
                    case KIND.METHOD: {
                        // "method" -- eg config, attrWhenReady -- shows param inline if one param
                        // (if more than one, which shouldn't happen currently, shows all in a list)
                        scope.mode = "method"; 
                        scope.icon = getIconForFunction(dsl); 
                        return;
                    }
                    case KIND.UTILITY: {
                        // "utility" -- eg format string -- shows first param inline, then other params in list
                        scope.mode = "utility"; 
                        scope.icon = getIconForFunction(dsl); 
                        return;
                    }
                    case KIND.TARGET: {
                        scope.mode = "target"; 
                        scope.icon = null;
                        scope.relatedEntity = getRelatedEntity(dsl);
                        return;
                    }
                }      
            }
            if (fam === FAMILY.CONSTANT) {
                scope.mode = "constant"; 
                scope.icon = null; 
                return;
            }
            if (fam === FAMILY.REFERENCE) {
                scope.mode = "reference"; 
                scope.icon = null; 
                return;
            }
            // catch-all
            $log.warn("unexpected DSL family, using default icon", dsl, dsl.kind);
            scope.icon = "fa-bolt";
            scope.mode = "DSL";
            return;
        };
        
        function getRelatedEntity(dsl) {
            if (dsl.params.length > 0) {
                // If the DSL is looking at an entity ID
                return dsl.getRoot().relationships.find(entity => entity.id === dsl.params[0].name)
            } else if (dsl.getRoot().relationships.length > 0) {
                // If the DSL is of the form $brooklyn:self() or $brooklyn:parent()
                return dsl.getRoot().relationships[0];
            } else {
                // Otherwise, there is no related entity
                return null;
            }
        }
        
        scope.$watch('dsl', () => {
            updateModeAndIcon(scope.dsl);
        }, true);
        
    }
}

function templateCache($templateCache) {
    $templateCache.put(TEMPLATE_URL, template);
}
