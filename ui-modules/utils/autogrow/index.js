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

const MODULE_NAME = 'br.utils.auto-grow';

angular.module(MODULE_NAME, [])
    .directive('autoGrow', [autoGrowDirective]);

export default MODULE_NAME;

export function autoGrowDirective() {
    return {
        require: 'ngModel',
        restrict: 'A',
        link: link
    };

    function link(scope, element, attrs, ctrl) {
        // can be use as `auto-grow="10"` to set max height as 10 lines, or just `auto-grow` to use default
        let maxRows = parseInt(attrs.autoGrow) || 15;

        element.css('height', 'auto');
        element.css('resize', 'none');
        
        function setClass(element, clazz, enabled) {
            if (enabled) {
                element.addClass(clazz);
            } else {
                element.removeClass(clazz);
            }
        }
        let update = () => {
            const text = ctrl.$modelValue || '';
            element[0].rows = Math.min(1 + (text.match(/\n/g) || []).length, maxRows);
            setClass(element, 'auto-grow-single-row', element[0].rows == 1);
            setClass(element, 'auto-grow-multi-row', element[0].rows > 1);
        };

        element.bind('keydown keypress', e => {
            if (e.which === 13 && (e.ctrlKey || e.metaKey || e.shiftKey)) {
                e.preventDefault();
                e.stopPropagation();
                let cursorPosition = element[0].selectionStart;
                ctrl.$setViewValue(ctrl.$modelValue.substring(0, cursorPosition) + "\n" + ctrl.$modelValue.substring(cursorPosition));
                ctrl.$render();
                scope.$apply(() => {
                    element[0].selectionEnd = cursorPosition + 1;
                });
                return false;
            }
        });

        scope.$watch(attrs.ngModel, update);
        attrs.$set('ngTrim', 'false');
    }
}
