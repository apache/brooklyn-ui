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

import {Api} from './api';

export class CatalogApi extends Api {
    constructor(cache, host) {
        super(cache, host);
    }

    create(data, params, opts) {
        // no-op
        return Promise.resolve();
    }

    getLocations(params, config) {
        // no-op
        return Promise.resolve();
    }

    getLocation(symbolicName, version, config) {
        // no-op
        return Promise.resolve();
    }

    deleteLocation(symbolicName, version, config) {
        // no-op
        return Promise.resolve();
    }

    getBundles(config) {
        // no-op
        return Promise.resolve();
    }

    getBundleVersions(symbolicName, config) {
        // no-op
        return Promise.resolve();
    }

    getBundle(symbolicName, version, config) {
        // no-op
        return Promise.resolve();
    }

    deleteBundle(symbolicName, version, config) {
        // no-op
        return Promise.resolve();
    }

    getTypes(config) {
        // no-op
        return Promise.resolve();
    }

    getType(typeSymbolicName, typeVersion, config) {
        // no-op
        return Promise.resolve();
    }

    getTypeVersions(typeSymbolicName, config) {
        // no-op
        return Promise.resolve();
    }

    getBundleTypes(bundleSymbolicName, bundleVersion, config) {
        // no-op
        return Promise.resolve();
    }

    getBundleType(bundleSymbolicName, bundleVersion, typeSymbolicName, typeVersion, config) {
        // no-op
        return Promise.resolve();
    }
}

window.CatalogApi = CatalogApi;