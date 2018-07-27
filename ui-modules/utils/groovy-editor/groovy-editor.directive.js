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
import angular from "angular";
import CodeMirror from "codemirror";
import "codemirror/mode/groovy/groovy.js";

const MODULE_NAME = 'brooklyn.ui.groovy.editor';
angular.module(MODULE_NAME, [])
    .directive('groovyEditor', groovyEditorDirective);
export default MODULE_NAME;

export function groovyEditorDirective() {
    return {
        restrict: 'E',
        scope: {
            value: '='
        },
        link: link
    };

    function link($scope, $element, $attrs) {
        var codeMirror = new CodeMirror($element[0], {
            value: $scope.value || '',
            lineNumbers: true,
            matchBrackets: true,
            mode: "text/x-groovy"
        });
        codeMirror.on('changes', function (cm, change) {
            if ($scope.value !== cm.getValue()) {
                $scope.$apply(()=> {
                    try {
                        codeMirror.clearGutter('groovy-errors');
                        $scope.value = cm.getValue();
                    } catch (err) {
                        if (err.hasOwnProperty('reason') && err.hasOwnProperty('mark')) {
                            cm.setGutterMarker(err.mark.line - 1, "groovy-errors", generateGutterMarker(err.reason));
                        }
                    }
                });
            }
        });
        $scope.$watch('value', (newVal, oldVal)=> {
            codeMirror.getDoc();
            codeMirror.focus();
            if (codeMirror.getValue() !== newVal) {
                codeMirror.setValue(newVal);
            }
            setTimeout(()=> {
                codeMirror.focus();
                codeMirror.refresh();
            });
        });
    }

    function generateGutterMarker(message) {
        var marker = document.createElement("div");
        marker.className = 'groovy-error-marker';
        marker.innerHTML = '<div class="groovy-error"><i class="groovy-error-icon fa fa-exclamation-circle"></i><span class="groovy-error-detail col-md-10">' + message + '</span></div>';
        return marker;
    }
}
