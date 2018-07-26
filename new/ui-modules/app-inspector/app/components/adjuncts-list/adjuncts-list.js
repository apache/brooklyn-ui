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
import brIconGenarator from 'brooklyn-ui-utils/icon-generator/icon-generator';
import brAutoFocus from 'brooklyn-ui-utils/autofocus/autofocus';
import {capitalize} from "brooklyn-ui-utils/utils/general";
import {timeAgoFilter} from '../task-list/task-list.directive';
import template from './adjuncts-list.html';

const MODULE_NAME = 'brooklyn.components.adjuncts-list';
const SUMMARY_HIGHLIGHTS = [
    'lastAction',
    'lastConfirmation',
    'lastViolation',
    'triggers'
];

function replaceStart(name, start, newStart) {
    if (name.startsWith(start)) {
        return newStart + name.substring(start.length);
    }
    return name;
}

export function capitalizeFilter() {
    return capitalize;
}

export function usefulNameFilter() {
    return usefulName;
}
function usefulName(name) {
    if (!name) return name;
    // poor man's attempt to make class names show up nicely
    // TODO replace this with intermediate ellipsis?
    // cf https://codepen.io/markchitty/pen/RNZbRE
    // (also make sure things have nice names!)
    
    if (name.length>50 && name.length - name.lastIndexOf('.') > 10) {
        name = name.substring(name.lastIndexOf('.')+1);
    }
    name = replaceStart(name, "org.apache.brooklyn.", "o.a.b.");
    name = replaceStart(name, "o.a.b.enricher.stock.", "o.a.b.e.s.");
    name = replaceStart(name, "o.a.b.entity.software.base.", "o.a.b.e.s.b.");
    return name;
}

angular.module(MODULE_NAME, [brIconGenarator, brAutoFocus])
    .directive('adjunctsList', adjunctsListDirective)
    .filter('timeAgo', timeAgoFilter)
    .filter('capitalize', capitalizeFilter)
    .filter('usefulName', usefulNameFilter);

export default MODULE_NAME;

export function adjunctsListDirective() {
    return {
        restrict: 'E',
        template: template,
        transclude: true,
        scope: {
            adjuncts: '<',
            summary: '<'
        },
        link: link
    };

    function link(scope) {
        scope.filters = {
            types: [],
            search: ''
        };

        scope.predicate = (value, index, array) => {
            let predicate = scope.filters.types.filter(types => types.active).map(types => types.value).includes(value.adjunctType);
            if (scope.filters.search) {
                let searchPredicate = value.name.toLowerCase().indexOf(scope.filters.search.toLowerCase()) > -1;
                if (value.description) {
                    searchPredicate |= value.description.toLowerCase().indexOf(scope.filters.search.toLowerCase()) > -1;
                }
                predicate &= searchPredicate;
            }
            return predicate;
        };

        function sortHighlights(highlights) {
            if (!highlights) return highlights;
            var result1 = [];
            for (var p in highlights) {
                var result1i = angular.copy(highlights[p]);
                result1i.id = p;
                result1i.display = "ITEM "+p;
                result1.push(result1i);
            }
            result1.sort(function(h1,h2) { return h2.time - h1.time; });
            var result2 = {};
            result1.forEach((x) => result2[x.id] = x);
            return result2;
        }
        
        function adjunctsWithHighlightsSorted() {
            var result = {};
            Object.values(scope.adjuncts).forEach((a) => 
                result[a.id] = sortHighlights(a.highlights));
            return result;
        }
        
        scope.$watch('adjuncts', (newValue, oldValue) => {
            scope.filters.types = scope.adjuncts.reduce((acc, adjunct) => {
                if (!acc.find(filter => filter.value === adjunct.adjunctType)) {
                    acc.push({
                        value: adjunct.adjunctType,
                        active: true
                    });
                }
                return acc;
            }, scope.filters.types);
            // a bit messy doing this in a watch, but calling the function on display
            // causing lots of iterator digest warnings
            scope.adjunctsWithHighlightsSorted = adjunctsWithHighlightsSorted();
        });

        scope.showHighlight = (id) => {
            return scope.summary ?
                SUMMARY_HIGHLIGHTS.includes(id) :
                true;
        }
    }
}
