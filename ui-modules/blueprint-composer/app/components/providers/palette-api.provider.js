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
import brApiModule from 'brooklyn-ui-utils/brooklyn.api/brooklyn.api';
import {PaletteApi} from './palette-api';

const MODULE_NAME = 'brooklyn.composer.api.palette';

angular.module(MODULE_NAME, [brApiModule])
    .provider('paletteApi', paletteApiProvider);

export default MODULE_NAME;

export function paletteApiProvider() {
    let implementation = PaletteApiProvider;

    return {
        implementation: function (impl) {
            if (!(impl.prototype === PaletteApi.prototype)) {
                throw new Error(`Expected an implementation extending ${PaletteApi} but got ${impl}`);
            }
            implementation = impl;
        },
        $get: ['catalogApi', 'locationApi', '$http', '$q', function (catalogApi, locationApi, $http, $q) {
            return new implementation(catalogApi, locationApi, $http, $q);
        }]
    }
}

class PaletteApiProvider extends PaletteApi {
    constructor(catalogApi, locationApi, $http, $q) {
        super($http, $q);
        this.catalogApi = catalogApi;
        this.locationApi = locationApi;
    }

    getTypes(params) {
        return this.catalogApi.getTypes(params);
    }

    getType(typeSymbolicName, typeVersion) {
        return this.catalogApi.getType(typeSymbolicName, typeVersion);
    }

    getTypeVersions(typeSymbolicName) {
        return this.catalogApi.getTypeVersions(typeSymbolicName);
    }

    getBundle(bundleSymbolicName, bundleVersion) {
        return this.catalogApi.getBundle(bundleSymbolicName, bundleVersion);
    }

    getBundleType(bundleSymbolicName, bundleVersion, typeSymbolicName, typeVersion) {
        return this.catalogApi.getBundleType(bundleSymbolicName, bundleVersion, typeSymbolicName, typeVersion);
    }

    getLocations() {
        return this.locationApi.getLocations().then(locations => {
            let supertypes = ['org.apache.brooklyn.api.location'];
            return locations.map(location => {
                if (location.catalog) {
                    location.catalog.displayName = location.config.displayName;
                    location.catalog.supertypes = supertypes;
                    return location.catalog;
                }
                return {
                    symbolicName: location.name,
                    displayName: location.config ? location.config.displayName : location.name,
                    supertypes: supertypes
                };
            });
        });
    }

    getLocation(locationSymbolicName) {
        return this.locationApi.getLocation(locationSymbolicName);
    }

    create(bom, params) {
        return this.catalogApi.create(bom, params);
    }
}