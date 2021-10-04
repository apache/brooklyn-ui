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
import template from './catalog-deleter.html';
import catalogApi from '../providers/catalog-api.provider';

const MODULE_NAME = 'brooklyn.components.catalog-deleter';

/**
 * @ngdoc module
 * @name brooklyn.components.catalog-deleter
 * @requires catalogApi
 *
 * @description
 * Adds an overlay on top of the current DOM element to upload files to the catalog. Files can either by added via
 * classic file selection or drag & drop. This support multiple files to be uploaded at once.
 */
angular.module(MODULE_NAME, [catalogApi])
    .directive('brooklynCatalogDeleter', ['$compile', 'catalogApi', 'brSnackbar', catalogDeleterDirective]);

export default MODULE_NAME;

function catalogDeleterDirective($compile, catalogApi, brSnackbar) {
    return {
        restrict: 'E',
        scope: {
            mode: '@',
            symbolicName: '<',
            version: '<',
            onDeleting: '&',
            onDeleted: '&',
            onFailed: '&',
            onDeletingFinished: '&',
        },
        template: template,
        controller: ['$scope', catalogDeleterController],
        controllerAs: 'vm',
    };

    function catalogDeleterController($scope) {
        let vm = this;

        $scope.id = $scope.symbolicName + ':' + $scope.version;

        function getBundle(bundleSymbolicName, bundleVersion) {
            catalogApi.getBundle(bundleSymbolicName, bundleVersion).then(data => {
                $scope.bundle = data;

            }).catch(err => {
                console.log("Error loading bundle: ", err);
                $scope.bundleError = true;
            }).finally(() => {
                $scope.bundleLoading = false;
            });
        }

        if ($scope.mode==='bundle') {
            $scope.bundleLoading = true;
            getBundle($scope.symbolicName, $scope.version);

        } else {
            $scope.bundleLoading = true;
            catalogApi.getType($scope.symbolicName, $scope.version).then(data => {
                let bundleSymbolicName, bundleVersion;
                if (data.containingBundle) {
                    let parts = data.containingBundle.split(':');
                    if (parts.length>=1) {
                        bundleSymbolicName = parts[0];
                        if (parts.length>=2) {
                            bundleVersion = parts[1];
                            if (parts.length>2) {
                                throw 'Invalid containing bundle '+data.containingBundle;
                            }
                        }
                    }
                }
                if (!bundleSymbolicName) {
                    throw 'Unavailable or invalid containing bundle '+data.containingBundle;
                }

                getBundle(bundleSymbolicName, bundleVersion);

            }).catch(err => {
                console.log("Error loading type: ", err);
                if ($scope.mode==='location') {
                    // don't display an error, probably it is a legacy-installed location
                } else {
                    $scope.bundleError = true;
                }
                $scope.bundleLoading = false;
            });
        }

        vm.delete = () => {
            if ($scope.onDeleting) $scope.onDeleting();
            let promise;
            if ($scope.mode==='bundle') {
                promise = catalogApi.deleteBundle($scope.symbolicName, $scope.version)
            } else if ($scope.mode==='location') {
                promise = catalogApi.deleteLocation($scope.symbolicName, $scope.version)
            } else if ($scope.mode==='type') {
                // not used
                throw 'deleteType not supported';
            } else {
                // shouldn't happen
                throw 'Unknown mode: '+$scope.mode;
            }

            promise.then(data => {
                if ($scope.onDeleted) $scope.onDeleted(data);
            }).catch(error => {
                let errorMessage= ('undefined' === typeof error.message)? error.error.message: error.message;
                brSnackbar.create('Could not delete this bundle: ' + errorMessage);
                if ($scope.onFailed) $scope.onFailed(error);
            }).finally(() => {
                if ($scope.onDeletingFinished) $scope.onDeletingFinished();
            });
        };
        vm.checkSingleBomBundle = (bundle) => {
            if (bundle) {
                if (bundle.format=='brooklyn-bom-bundle' && bundle.types && bundle.types.length===1 && bundle.types[0].symbolicName===$scope.symbolicName && bundle.types[0].version===$scope.version) {
                    return 'single-bom-match';
                }
            }
            return 'default';
        }
    }

}
