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

const MODULE_NAME = 'brooklyn.component.sensitive-field';
export const SENSITIVE_FIELD_REGEX = /^.*(passw(or)?d|credentials?|secret|private|access\.certs?|access\.keys?).*$/i;
const CLASS_NAME = 'sensitive-field';
const CLASS_NAME_SHOW = 'sensitive-field-show';

angular.module(MODULE_NAME, [])
    .directive('sensitiveField', SensitiveFieldDirective);

export default MODULE_NAME;

export function SensitiveFieldDirective() {
    return {
        restrict: 'A',
        scope: {fieldName: '@', hideValue: '@'},
        link: link
    };
    function link($scope, $element) {
        if (SENSITIVE_FIELD_REGEX.test($scope.fieldName.trim()) || $scope.hideValue) {
            $element.addClass(CLASS_NAME);
            $element.bind('click', clickEventHandler);
        } else {
            $element.removeClass(CLASS_NAME);
            $element.unbind('click', clickEventHandler);
        }
        function clickEventHandler() {
            if ($element.hasClass(CLASS_NAME)) {
                $element.toggleClass(CLASS_NAME_SHOW);
            } else {
                $element.removeClass(CLASS_NAME_SHOW);
            }
        }
    }
}
