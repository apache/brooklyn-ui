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
import {KIND} from '../util/model/dsl.model';

const MODULE_NAME = 'brooklyn.components.dsl-viewer';
const TEMPLATE_URL = 'blueprint-composer/component/dsl-viewer/index.html';

angular.module(MODULE_NAME, [])
    .directive('dslViewer', dslViewerDirective)
    .run(['$templateCache', templateCache]);

export default MODULE_NAME;

export function dslViewerDirective() {
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
        scope.isTargetDsl = (dsl) => {
            return dsl.kind === KIND.TARGET;
        };
        scope.isMethodDsl = (dsl) => {
            return dsl.kind === KIND.METHOD;
        };
        scope.isFormatStringDsl = (dsl) => {
            return dsl.kind === KIND.UTILITY && dsl.name === 'formatString';
        };
        scope.isLiteralDsl = (dsl) => {
            return [KIND.STRING, KIND.NUMBER].includes(dsl.kind);
        };
        scope.getRelatedEntity = () => {
            if (scope.dsl.params.length > 0) {
                // If the DSL is looking at an entity ID
                return scope.dsl.getRoot().relationships.find(entity => entity.id === scope.dsl.params[0].name)
            } else if (scope.dsl.getRoot().relationships.length > 0) {
                // If the DSL is of the form $brooklyn:self() or $brooklyn:parent()
                return scope.dsl.getRoot().relationships[0];
            } else {
                // Otherwise, there is no related entity
                return null;
            }
        }
    }
}

function templateCache($templateCache) {
    $templateCache.put(TEMPLATE_URL, template);
}
