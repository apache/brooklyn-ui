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
import marked from 'marked';

const MODULE_NAME = 'br.utils.md-helper';

angular.module(MODULE_NAME, [])
    .factory("mdHelper", mdHelperProvider)
    .directive('mdField', [ mdFieldDirective])
    .directive('mdFirstLine', [ mdFirstLineDirective])
    .directive('mdIfOneline', [ mdIfOnelineDirective])
    .directive('mdIfMultiline', [mdIfMultilineDirective]);

export default MODULE_NAME;

// displays markdown, as one-line or multi-line depending on the data
export function mdFieldDirective() {
    return {
        restrict: 'E',
        scope: {
            data: '<',
            rawData: '<',
        },
        template: `
            <div>
                <md-if-oneline data="data"></md-if-oneline>
                <md-if-multiline data="data"></md-if-multiline>
            </div>
        `,
        controller: ['$scope', function ($scope) {
            if ($scope.rawData && !$scope.data) {
                $scope.data = analyze($scope.rawData);
            }
        }],
    };

    function link(scope, element, attrs) {
    }
}

// prints out one line of data -- in future could use markdown formatting, but currently does not
export function mdFirstLineDirective() {
    return {
        restrict: 'E',
        scope: {
            data: '<',
        },
        template: `
            <span>{{::data.oneline}}</span>
        `,
    };

    function link(scope, element, attrs) {
    }
}

// prints out full, formatted, _if_ it is one line of data
export function mdIfOnelineDirective() {
    return {
        restrict: 'E',
        scope: {
            data: '<',
        },
        template: `
            <div ng-if="data.isNonMultiline">
                <p ng-if="data.unformatted">{{data.unformatted}}</p>
                <div ng-if="data.markdownFormatted" ng-bind-html="data.markdownFormatted"></div>
            </div>
        `,
    };

    function link(scope, element, attrs) {
    }
}

// prints out all the data, formatted, if multiline
export function mdIfMultilineDirective() {
    return {
        restrict: 'E',
        scope: {
            data: '<',
        },
        template: `
            <div ng-if="data.isMultiline">
                <pre ng-if="data.unformatted">{{data.unformatted}}</pre>
                <div ng-if="data.markdownFormatted" ng-bind-html="data.markdownFormatted"></div>
            </div>
        `,
    };
}

export function analyzeDescription(input) {
    input = input || {};
    return analyze(input.description, [input.symbolicName, input.displayName, input.name]);
}

export function analyze(field, names) {
    let result = {
        isPresent: !!field,
    };
    result.isMultiline = !!(result.isPresent && (field.trim().match(/^#+($| )/) || field.split('\n', 5)>5));
    result.isNonMultiline = result.isPresent && !result.isMultiline;
    if (result.isPresent) {
        try {
            result.markdownFormatted = marked(field);
        } catch (e) {
            // not markdown
            result.unformatted = field;
        }
    }
    result.oneline = oneline(field, names);
    return result;
}

function containsAny(line, words) {
    if (!words) return false;
    return words.filter(w => w && line.indexOf(w)>=0);
}

export function oneline(field, names) {
    if (!field) {
        return null;
    }
    if (field.trim().match(/^#+($| )/)) {
        // looks like markdown; skip line if it's a title
        let inputStripped = field.trim().substring(1);
        let line1 = inputStripped.split('\n', 1)[0].trim();

        if (!line1 || (containsAny(line1, names) && line1.length<100)) {
            // probably a summary eg "About FooEntity" -- ignore
            inputStripped = /\n((.*)(\n.*)*)/.exec(inputStripped)[1]
            if (!inputStripped) return null;
            return oneline(inputStripped, names);
        }

        // otherwise use default behaviour

        field = line1;
    }

    let dStrippedP = field.trim().split('\n', 2);
    let d = dStrippedP[0];

    if (d.length > 200) {
        // if very long then truncate and return...
        return d.substring(0,197)+"...";
    } else {
        if (dStrippedP[1] !== undefined) {
            d += " ...";
        }
        return d;
    }
}

function mdHelperProvider() {
    return {
        analyze,
        analyzeDescription,
    }
}