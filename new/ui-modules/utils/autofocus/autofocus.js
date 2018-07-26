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

const MODULE_NAME = 'br.utils.auto-focus';

angular.module(MODULE_NAME, [])
    .directive('autoFocus', ['$timeout', '$window', '$document', autoFocusDirective]);

export default MODULE_NAME;

export function autoFocusDirective($timeout, $window, $document) {
    return {
        restrict: 'A',
        link: link
    };

    function link(scope, element, attrs) {
        if (attrs.autoFocus) {
            scope.$watch(attrs.autoFocus, focus);
        } else {
            focus(true);
        }
        
        // focus / activeElement seems to get lost on some inputs when window loses focus,
        // e.g. if the element is hidden. use this to restore it.
        // (if auto-focus-listen-to-window is set)
        if (attrs.autoFocusListenToWindow) {
            angular.element( $window ).on( "focus", () => { focus(scope.$eval(attrs.autoFocus)); } );
        }

        function isAncestor(node, possibleAncestor) {
            let last = null;
            while (last!=node && node!=null) {
                if (node == possibleAncestor) return true;
                last = node;
                node = node.parentElement;
            }
            return false;
        }
        
        function focus(autoFocus) {
            if (autoFocus) {
                // this can steal focus from children, use auto-focus-not-if-within to prevent that
                if (attrs.autoFocusNotIfWithin && $document[0].activeElement) {
                    if (isAncestor($document[0].activeElement, element[0])) {
                        return;
                    }
                }
                $timeout(function() {
                    element[0].focus();
                }, scope.$eval(attrs.autoFocusDelay) || 0);
            }
        }
    }
}
