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
import CodeMirror from 'codemirror';
import 'codemirror/mode/yaml/yaml';
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/indent-fold';
import 'codemirror/addon/fold/comment-fold';
import 'codemirror/addon/lint/lint';
import './addon/lint/lint-yaml-brooklyn';
import './addon/lint/lint-yaml-tab';
import 'codemirror/addon/hint/show-hint';
import './addon/hint/super-hint';
import './addon/hint/super-hint-yaml-schema';
import './addon/hint/super-hint-yaml-type';
import './addon/hint/super-hint-yaml-anchor';

const MODULE_NAME = 'brooklyn.component.yaml-editor';

angular.module(MODULE_NAME, [])
    .directive('brYamlEditor', ['$rootScope', 'brSnackbar', yamlEditorDirective]);

export default MODULE_NAME;

export function yamlEditorDirective($rootScope, brSnackbar) {
    return {
        restrict: 'E',
        scope: {
            type: '@',
            value: '=',
            onChange: '&'
        },
        link: link
    };

    function link($scope, $element) {
        $scope.type = $scope.type || 'brooklyn';

        // Init CodeMirror
        CodeMirror.extendMode('yaml', {
            fold: 'indent',
            type: $scope.type
        });

        let lint = (text, cb, options, cm) => {
            let promises = cm.getHelpers(CodeMirror.Pos(0, 0), 'lint').reduce((issues, helper) => issues.concat(helper(text, options, cm)), []);

            Promise.all(promises).then(issues => {
                $rootScope.$broadcast('yaml.lint', issues.some(issue => !issue.severity || issue.severity === 'error'), cm.getValue());
                cb(cm, issues.reduce((acc, arr) => {
                    acc.push(...arr);
                    return acc;
                }, []));
            });
        }
        let hint = (cm, callback, options) => {
            let loadingState = createLoadingState();
            let removeLoadingState = () => {
                if (loadingState) {
                    loadingState.remove();
                }
                cm.off('cursorActivity', removeLoadingState);
            };

            cm.on('cursorActivity', removeLoadingState);
            cm.addWidget(cm.getCursor(), loadingState);

            let promises = cm.getHelpers(CodeMirror.Pos(0, 0), 'hint').reduce((promises, helper) => promises.concat(helper(cm, options)), []);

            Promise.all(promises).then(results => {
                removeLoadingState();

                callback(results.reduce((hints, result) => {
                    let list = hints.list.concat(result.list);
                    list.sort();
                    return Object.assign(hints, result, {list: list});
                }, {list: []}));
            }).catch(error => {
                removeLoadingState();

                $scope.$apply(() => {
                    brSnackbar.create(error.message);
                });

                callback({
                    list: [],
                    from: cm.getCursor(),
                    to: cm.getCursor()
                });
            });
        };
        hint.async = true;

        let createLoadingState = () => {
            let loadingState = document.createElement('ul');
            loadingState.className = 'CodeMirror-hints';
            let loading = loadingState.appendChild(document.createElement('li'));
            loading.className = 'CodeMirror-hint CodeMirror-hint-loading';
            loading.appendChild(document.createTextNode('Loading'));

            return loadingState;
        };

        $scope.cm = new CodeMirror($element[0], {
            value: $scope.value || '',
            styleActiveLine: true,
            matchBrackets: true,
            theme: 'eclipse',
            lineNumbers: true,
            lineWrapping: true,
            foldGutter: true,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-lint-markers', 'CodeMirror-foldgutter'],
            mode: {
                name: 'yaml',
                globalVars: true
            },
            lint: {
                getAnnotations: lint,
                async: true,
                timeout: 1000
            },
            extraKeys: {
                'Ctrl-Space': 'autocomplete',
                'Tab': cm => {
                    let wideSelection = cm.listSelections().reduce((acc, range) => {
                        if ((range.anchor.line !== range.head.line) || (range.anchor.ch !== range.head.ch)) {
                            return acc || true;
                        }
                        return acc;
                    }, false);

                    if (wideSelection) {
                        CodeMirror.commands.indentMore(cm);
                    } else {
                        cm.replaceSelection('  ', 'end');
                    }
                }
            },
            foldOptions: {
                widget: '{ ... }'
            }
        });
        $scope.cm.on('changes', (cm, change)=> {
            if ($scope.value !== cm.getValue()) {
                $scope.$apply(()=> {
                    $scope.value = cm.getValue();
                    let fn = $scope.onChange();
                    if (angular.isFunction(fn)) {
                        fn(cm);
                    }
                });
            }
        });
        $scope.cm.on('superhint-error', (error) => {
            $scope.$apply(()=> {
                brSnackbar.create(error.message);
            });
        });

        $scope.$watch('value', (newVal, oldVal)=> {
            $scope.cm.getDoc();
            $scope.cm.focus();
            if ($scope.cm.getValue() !== newVal && angular.isDefined(newVal)) {
                $scope.cm.setValue(newVal);
            }
            setTimeout(()=> {
                $scope.cm.focus();
                $scope.cm.refresh();
            });
        });

        $scope.$on(`${MODULE_NAME}.cm`, (event, callback) => {
            if (angular.isFunction(callback)) {
                callback.apply(null, [CodeMirror, $scope.cm]);
            }
        });
    }
}
