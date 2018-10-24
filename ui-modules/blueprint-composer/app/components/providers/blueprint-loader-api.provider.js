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
import {BlueprintLoaderApi} from './blueprint-loader-api';

const MODULE_NAME = 'brooklyn.composer.api.blueprint-loader';

angular.module(MODULE_NAME, [])
    .provider('blueprintLoaderApi', blueprintLoaderApi);

export default MODULE_NAME;

export function blueprintLoaderApi() {
    let implementation = BlueprintLoaderApiProvider;

    return {
        implementation: function (impl) {
            if (!(impl.prototype === BlueprintLoaderApi.prototype)) {
                throw new Error(`Expected an implementation extending ${BlueprintLoaderApi} but got ${impl}`);
            }
            implementation = impl;
        },
        $get: ['$stateParams', '$q', 'paletteApi', function ($stateParams, $q, paletteApi) {
            return new implementation($stateParams, $q, paletteApi);
        }]
    }
}

class BlueprintLoaderApiProvider extends BlueprintLoaderApi {
    constructor($q, paletteApi) {
        super($q, paletteApi);
    }

    loadBlueprint($stateParams) {
        let deferred = this.$q.defer();
        if (!($stateParams.bundleSymbolicName && $stateParams.bundleVersion && $stateParams.typeSymbolicName && $stateParams.typeVersion)) {
            deferred.resolve(null);
        } else if ($stateParams.bundleSymbolicName && $stateParams.bundleVersion && $stateParams.typeSymbolicName && $stateParams.typeVersion) {
            this.$q.all([
                this.paletteApi.getBundle($stateParams.bundleSymbolicName, $stateParams.bundleVersion),
                this.paletteApi.getBundleType($stateParams.bundleSymbolicName, $stateParams.bundleVersion, $stateParams.typeSymbolicName, $stateParams.typeVersion),
                this.paletteApi.getTypeVersions($stateParams.typeSymbolicName)
            ]).then(responses => {
                deferred.resolve({bundle: responses[0], type: responses[1], versions: responses[2].map(item => item.version)});
            }).catch(response => deferred.reject(response.error.message));
        } else {
            deferred.reject('Both bundle and type information must be supplied');
        }
        return deferred.promise;
    }

    loadYaml($stateParams) {
        return $stateParams.yaml;
    }
}