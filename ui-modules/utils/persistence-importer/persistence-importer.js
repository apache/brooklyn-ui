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
import template from './persistence-importer.html';
import serverApi from '../../utils/api/brooklyn/server.js';

const MODULE_NAME = 'brooklyn.components.persistence-importer';

/**
 * @ngdoc module
 * @name brooklyn.components.persistence-importer
 * @requires serverApi
 *
 * @description
 * TODO
 */
angular.module(MODULE_NAME, [serverApi])
    .service('brooklynPersistenceImporter', ['$q', 'serverApi', persistenceImporterService])
    .directive('customOnChange', customOnChangeDirective)
    .directive('brooklynPersistenceImporter', ['$compile', 'brooklynPersistenceImporter', persistenceImporterDirective]);

export default MODULE_NAME;

/**
 * @ngdoc directive
 * @name brooklynPersistenceImporter
 * @module brooklyn.components.persistence-importer
 * @restrict A
 *
 * @description
 * TODO
 *
 * @param {string} brooklynPersistenceImporter The value can be empty. Otherwise, the directive will listen for any event broadcasted
 * with this name and will trigger the overlay upon reception.
 */
export function persistenceImporterDirective($compile, brooklynPersistenceImporter) {
    return {
        restrict: 'A',
        link: link
    };

    function link(scope, element, attrs) {
        let div = document.createElement('div');
        if ((('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window && 'FileReader' in window) {
            element.addClass('br-has-drag-upload');
        }

        element.append($compile(template)(scope));

        let counter = 0;
        element.bind('drag dragstart dragend dragover dragenter dragleave drop', (event)=> {
            event.preventDefault();
            event.stopPropagation();
        }).bind('drag dragstart dragover dragenter', (event)=> {
            event.dataTransfer.dropEffect = 'copy';
            element.addClass('br-drag-active');
        }).bind('dragenter', ()=> {
            counter++;
        }).bind('dragleave', (event)=> {
            counter--;
            if (counter === 0) {
                element.removeClass('br-drag-active');
            }
        }).bind('drop', (event)=> {
            scope.upload(event.dataTransfer.files);
        });

        let field = attrs.brooklynPersistenceImporter;
        if (angular.isDefined(field)) {
            scope.$on(field, ()=> {
                counter++;
                element.addClass('br-drag-active');
            });
        }

        scope.selectedFiles = [];

        scope.close = ()=> {
            counter--;
            element.removeClass('br-drag-active');
        };

        scope.filesChanged = (event)=> {
            scope.upload(event.target.files);
        };

        scope.upload = (files)=> {
            for (let i = 0; i < files.length; i++) {
                let file = files[i];

                brooklynPersistenceImporter.upload(file).then((data)=> {
                    file.result = data;
                }).catch((error)=> {
                    file.error = error;
                }).finally(()=> {
                    scope.$applyAsync();
                });

                scope.selectedFiles.unshift(file);
                scope.$apply();
            }
        };

        scope.getPersistenceItemUrl = (item)=> {
            let itemTraits = item.tags? item.tags.find(item => item.hasOwnProperty("traits")) : {"traits":[]};
            return (item.supertypes ? item.supertypes : itemTraits.traits)
                .includes('org.apache.brooklyn.api.location.Location')
                ? `/brooklyn-ui-location-manager/#!/location?symbolicName=${item.symbolicName}&version=${item.version}`
                : `/brooklyn-ui-persistence/#!/bundles/${item.containingBundle.split(':')[0]}/${item.containingBundle.split(':')[1]}/types/${item.symbolicName}/${item.version}`;
        };
    }
}

/**
 * @ngdoc service
 * @name brooklynPersistenceImporter
 * @module brooklyn.components.persistence-importer
 *
 * @description
 * Encapsulate the logic to validate files to upload to the persistence.
 */
export function persistenceImporterService($q, serverApi) {
    let extensions = {
        'zip' : {
            headers: {  'Content-Type': 'multipart/form-data',
                        'Accept': 'application/json',
                        'Brooklyn-Allow-Non-Master-Access': 'true'},
            transformRequest: angular.identity
        }
    };

    return {
        /**
         * @ngdoc method
         * @name upload
         * @methodOf brooklynPersistenceImporter
         *
         * @description
         * Upload a file to the persistence. This will validate the extensions and reject the promises if the current one is
         * not supported.
         *
         * @param {object} file A file object, representing a file to upload to the persistence.
         *
         * @return A promise that gets resolve if the upload *and* process of the file server side is successful; the
         * resolve data contains the persistence items that have been added a map of `{id: item}`. Otherwise, the promise
         * is rejected with the error message as parameter.
         */
        upload: upload
    };

    function upload(file) {
        let defer = $q.defer();

        if (new RegExp('^.*\.(' + Object.keys(extensions).join('|') + ')$').test(file.name)) {
            Object.keys(extensions).forEach((extension)=> {
                if (!new RegExp('^.*\.(' + extension + ')$').test(file.name)) {
                    return;
                }

                let options = extensions[extension];
                let reader = new FileReader();
                reader.addEventListener('load', ()=> {
                    try {
                        let rawData = new Uint8Array(reader.result);
                        serverApi.importPersistenceData(rawData, options).then((response)=> {
                            defer.resolve(response);
                        }).catch((response)=> {
                            defer.reject('Cannot upload item to the persistence: ' + response.error.message);
                        });
                    } catch (error) {
                        defer.reject('Cannot read file: ' + error.message);
                    }
                }, false);
                reader.readAsArrayBuffer(file);
            });
        } else {
            defer.reject('Unsupported file type. Please upload only files with the following extensions: ' + Object.keys(extensions).map((extension)=>('*.' + extension)).join(', '));
        }

        return defer.promise;
    }
}

export function customOnChangeDirective() {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            element.on('change', x => {
                var onChangeHandler = scope.$eval(attrs.customOnChange);
                onChangeHandler(x);
            });
            element.on('$destroy', function() {
                element.off();
            });
        }
    };
}