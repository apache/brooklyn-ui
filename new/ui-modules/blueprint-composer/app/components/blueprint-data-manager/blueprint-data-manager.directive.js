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
import template from "./blueprint-data-manager.template.html";
import {saveAs} from "file-saver/FileSaver";
const VALID_FILENAME_REGEX = /^.*\.ya?ml$/
const FILETYPE_TOKEN_REGEX = /^.*\.(.*)$/

export function blueprintDataManagerDirective() {
    return {
        restrict: 'E',
        template: template,
        controller: ['$rootScope', '$scope', '$element', '$document', 'blueprintService', 'brSnackbar', controller]
    };

    function controller($rootScope, $scope, $element, $document, blueprintService, brSnackbar) {
        var fileInputElement = null;
        $scope.fileInputId = 'hidden-load-file-input-' + Math.random().toString(36).slice(2);
        $scope.dragging = false;
        $scope.targetActive = false;
        $scope.openFileDialog = openFileDialog;
        $scope.saveBlueprint = saveBlueprint;

        $document.bind('drag dragstart dragend dragover dragenter dragleave drop', (event)=> {
            event.preventDefault();
            event.stopPropagation();
        }).bind('drag dragstart dragover dragenter', (event)=> {
            $element.addClass('drag-active');
        }).bind('mouseout dragend drop', (event)=> {
            $element.removeClass('drag-active');
            $element.removeClass('drag-target-active');
        });

        $element.bind('drag dragstart dragend dragover dragenter dragleave drop', (event)=> {
            event.preventDefault();
            event.stopPropagation();
        }).bind('dragstart dragover dragenter', (event)=> {
            event.dataTransfer.dropEffect = 'copy';
            $element.addClass('drag-active');
            $element.addClass('drag-target-active');
        }).bind('dragleave dragend drop', (event)=> {
            $element.removeClass('drag-active');
            $element.removeClass('drag-target-active');
        }).bind('drop', (event)=> {
            readFile(event.dataTransfer.files[0]);
        });

        $document.bind('keydown', (event)=> {
            if (event.keyCode === 83 && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                saveBlueprint();
            }
        });

        function notify(message) {
            $rootScope.$apply(brSnackbar.create(message));
        }

        function saveBlueprint() {
            try {
                var yaml = blueprintService.getAsYaml();
                if (yaml.length > 0) {
                    var blob = new Blob([yaml], {type: 'text/plain;charset=' + document.inputEncoding || 'UTF-8'});
                    saveAs(blob, 'blueprint-' + Date.now() + '.yaml');
                } else {
                    notify('Blueprint not saved ... empty');
                }
            } catch (error) {
                notify('Blueprint saved');
            }
        }

        function readFile(file) {
            if (VALID_FILENAME_REGEX.test(file.name)) {
                var reader = new FileReader();
                reader.addEventListener("load", function () {
                    try {
                        var yaml = reader.result;
                        blueprintService.setFromYaml(yaml, true);
                        $rootScope.$broadcast('d3.redraw', true);
                        notify('Blueprint loaded successfully');
                    } catch (error) {
                        notify('Failed to load blueprint ' + error.message);
                    }
                }, false);
                reader.readAsText(file);
            } else {
                var match = file.name.match(FILETYPE_TOKEN_REGEX);
                notify('Incorrect file type [' +
                    ((match.length === 2) ? match[1] : match[0] ) + '] ... supported file types [yml, yaml]');
            }
        }

        function openFileDialog() {
            fileInputElement.click();
        }

        setTimeout(()=> {
            fileInputElement = document.getElementById($scope.fileInputId);
            fileInputElement.addEventListener('change', (e)=> {
                readFile(e.target.files[0]);
            }, false);
        });
    }
}
