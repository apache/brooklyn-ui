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
import template from './catalog-uploader.html';
import catalogApi from '../providers/catalog-api.provider';

const MODULE_NAME = 'brooklyn.components.catalog-uploader';

/**
 * @ngdoc module
 * @name brooklyn.components.catalog-uploader
 * @requires catalogApi
 *
 * @description
 * Adds an overlay on top of the current DOM element to upload files to the catalog. Files can either by added via
 * classic file selection or drag & drop. This support multiple files to be uploaded at once.
 */
angular.module(MODULE_NAME, [catalogApi])
    .service('brooklynCatalogUploader', ['$q', 'catalogApi', catalogUploaderService])
    .directive('customOnChange', customOnChangeDirective)
    .directive('brooklynCatalogUploader', ['$compile', '$rootScope', 'brooklynCatalogUploader', catalogUploaderDirective]);

export default MODULE_NAME;

export const CATALOG_UPLOAD_COMPLETED = "brooklyn-catalog-upload-completed";

/**
 * @ngdoc directive
 * @name brooklynCatalogUploader
 * @module brooklyn.components.catalog-uploader
 * @restrict A
 *
 * @description
 * Attaches an overlay on the current DOM element to handle file upload to the catalog. Files can either by added via
 * classic file selection or drag & drop. The overlay can be triggered by broadcasting an event: for this to work, the
 * event name needs to be passed as value for the `brooklynCatalogUploader` attribute.
 *
 * @param {string} brooklynCatalogUploader The value can be empty. Otherwise, the directive will listen for any event broadcasted
 * with this name and will trigger the overlay upon reception.
 */
export function catalogUploaderDirective($compile, $rootScope, brooklynCatalogUploader) {
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
        let requireManualClose = false;
        element.bind('drag dragstart dragend dragover dragenter dragleave drop', (event)=> {
            event.preventDefault();
            event.stopPropagation();
        }).bind('drag dragstart dragover dragenter', (event)=> {
            event.dataTransfer.dropEffect = 'copy';
            element.addClass('br-drag-active');
            element.addClass('br-drag-active-2');
        }).bind('dragenter', ()=> {
            counter++;
        }).bind('dragleave', (event)=> {
            counter--;
            element.removeClass('br-drag-active-2');
            if (!requireManualClose && counter === 0) element.removeClass('br-drag-active'); // close if we were triggered by a drag
        }).bind('drop', (event)=> {
            scope.upload(event.dataTransfer.files);
            counter--;
            element.removeClass('br-drag-active-2');
            requireManualClose = true;
            if (!requireManualClose && counter === 0) element.removeClass('br-drag-active'); // close if we were triggered by a drag
        });

        let field = attrs.brooklynCatalogUploader;
        if (angular.isDefined(field)) {
            scope.$on(field, ()=> {
                requireManualClose = true;
                element.addClass('br-drag-active');
            });
        }

        scope.selectedFiles = [];

        scope.close = ()=> {
            requireManualClose = false;
            counter = 0;
            scope.selectedFiles = []; // clean up the imported file list on returning to catalog, still needs a manual refresh to show the imported bundle
            element.removeClass('br-drag-active');
        };

        scope.filesChanged = (event)=> {
            scope.upload(event.target.files);
        };

        scope.upload = (files)=> {
            for (let i = 0; i < files.length; i++) {
                let file = files[i];

                brooklynCatalogUploader.upload(file).then((data)=> {
                    file.result = data;
                    $rootScope.$broadcast(CATALOG_UPLOAD_COMPLETED);
                }).catch((error)=> {
                    console.warn("ERROR uploading "+file, error);
                    file.error = error;
                }).finally(()=> {
                    scope.$applyAsync();
                });

                scope.selectedFiles.unshift(file);
                scope.$apply();
            }
        };

        scope.getCatalogItemUrl = (item)=> {
            let itemTraits = item.tags? item.tags.find(item => item.hasOwnProperty("traits")) : {"traits":[]};
            return (item.supertypes ? item.supertypes : itemTraits.traits)
                .includes('org.apache.brooklyn.api.location.Location')
                ? `/brooklyn-ui-location-manager/#!/location?symbolicName=${item.symbolicName}&version=${item.version}`
                : `/brooklyn-ui-catalog/#!/bundles/${item.containingBundle.split(':')[0]}/${item.containingBundle.split(':')[1]}/types/${item.symbolicName}/${item.version}`;
        };
    }
}

/**
 * @ngdoc service
 * @name brooklynCatalogUploader
 * @module brooklyn.components.catalog-uploader
 *
 * @description
 * Encapsulate the logic to validate files to upload to the catalog.
 */
export function catalogUploaderService($q, catalogApi) {
    function getFileTypeProperties(fn) {
      if (!fn) return null;
      const fnl = fn.toLowerCase();
      if (["bom","yml","yaml"].find(ext => fnl.endsWith("."+ext))) {
        return {
          http: {
            headers: {'Content-Type': 'application/yaml'}
          }
        };
      }
      if (fnl.endsWith(".jar")) {
        return {
          binary: true,
          http: {
            headers: {'Content-Type': 'application/x-jar'},
            transformRequest: angular.identity 
          }
        };
      }
      if (fnl.endsWith(".zip") || fnl.endsWith("ar")) {  // support other archive types, tar, csar, etc
        return {
          binary: true,
          http: { 
            headers: {'Content-Type': 'application/x-zip'},
            transformRequest: angular.identity 
          }
        };
      }
      return null;
    }

    return {
        /**
         * @ngdoc method
         * @name upload
         * @methodOf brooklynCatalogUploader
         *
         * @description
         * Upload a file to the catalog. This will validate the extensions and reject the promises if the current one is
         * not supported.
         *
         * @param {object} file A file object, representing a file to upload to the catalog.
         *
         * @return A promise that gets resolve if the upload *and* process of the file server side is successful; the
         * resolve data contains the catalog items that have been added a map of `{id: item}`. Otherwise, the promise
         * is rejected with the error message as parameter.
         */
        upload: upload
    };

    function upload(file) {
        let defer = $q.defer();

        const options = getFileTypeProperties(file.name);

        if (options!=null) {
                let reader = new FileReader();
                reader.addEventListener('load', ()=> {
                    try {
                        let rawData = new Uint8Array(reader.result);
                        let data = options.binary ? rawData : String.fromCharCode.apply(null, rawData);
                        catalogApi.create(data, {}, options.http).then((response)=> {
                            defer.resolve(response);
                        }).catch((response)=> {
                            defer.reject('Cannot upload item to the catalog: ' + response.error.message);
                        });
                    } catch (error) {
                        defer.reject('Cannot read file: ' + error.message);
                    }
                }, false);
                reader.readAsArrayBuffer(file);
        } else {
            defer.reject("Unsupported file type. Supported types include BOM, YAML, and ZIP. The extension is significant.");
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
