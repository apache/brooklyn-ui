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
import {ErrorHandler, SuccessHandler} from './handlers';
import {CatalogApi} from './catalog-api';

const MODULE_NAME = 'brooklyn.utils.api.catalog';

angular.module(MODULE_NAME, [])
    .provider('catalogApi', catalogApiProvider);

export default MODULE_NAME;

export function catalogApiProvider() {
    let cacheName = '$http';
    let host = '';
    let implementation = CatalogApiProvider;

    return {
        cacheName: function (value) {
            cacheName = value;
        },
        host: function (value) {
            host = value;
        },
        implementation: function (impl) {
            if (!(impl.prototype === CatalogApi.prototype)) {
                throw new Error(`Expected an implementation extending ${CatalogApi} but got ${impl}`);
            }
            implementation = impl;
        },
        $get: ['$http', '$q', '$cacheFactory', function ($http, $q, $cacheFactory) {
            let cache = $cacheFactory.get(cacheName) || $cacheFactory(cacheName);
            return new implementation($http, $q, cache, host);
        }]
    };
}

class CatalogApiProvider extends CatalogApi {
    constructor($http, $q, cache, host) {
        super(cache, host);
        this.$http = $http;
        this.$q = $q;
    }

    create(data, params={}, opts={}) {
        let deferred = this.$q.defer();
        this.$http({
            method: 'POST',
            url: `${this.host}/v1/catalog`,
            data,
            params,
            ...opts,
        })
        .then(new SuccessHandler(deferred))
        .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getApplications(term, opts) {
        let deferred = this.$q.defer();
        this.$http({
            method: 'GET',
            url: `${this.host}/v1/catalog/applications`,
            params: Object.assign({
                fragment: term
            }, opts || {}),
            cache: this.cache
        }).then(new SuccessHandler(deferred)).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getApplication(applicationId, version) {
        let deferred = this.$q.defer();
        this.$http({
            method: 'GET',
            url: `${this.host}/v1/catalog/applications/${applicationId}/${version ? version : 'latest'}`,
            cache: this.cache
        }).then(new SuccessHandler(deferred)).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getLocations(params, config) {
        let deferred = this.$q.defer();
        this.$http.get(`${this.host}/v1/catalog/locations`, angular.extend({cache: this.cache, params: params}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getLocation(symbolicName, version, config) {
        let deferred = this.$q.defer();
        this.$http.get(`${this.host}/v1/catalog/locations/${symbolicName}/${version ? version : 'latest'}`, angular.extend({cache: this.cache}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    deleteLocation(symbolicName, version, config) {
        let deferred = this.$q.defer();
        this.$http.delete(`${this.host}/v1/catalog/locations/${symbolicName}/${version ? version : 'latest'}`, angular.extend({}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getBundles(config) {
        let deferred = this.$q.defer();
        this.$http.get(`${this.host}/v1/catalog/bundles`, angular.extend({}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getBundleVersions(symbolicName, config) {
        let deferred = this.$q.defer();
        this.$http.get(`${this.host}/v1/catalog/bundles/${symbolicName}`, angular.extend({}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getBundle(symbolicName, version, config) {
        let deferred = this.$q.defer();
        this.$http.get(`${this.host}/v1/catalog/bundles/${symbolicName}/${version}`, angular.extend({}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    deleteBundle(symbolicName, version, config) {
        let deferred = this.$q.defer();
        this.$http.delete(`${this.host}/v1/catalog/bundles/${symbolicName}/${version}`, angular.extend({}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getTypes(config) {
        let deferred = this.$q.defer();
        this.$http.get(`${this.host}/v1/catalog/types`, angular.extend({}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getType(typeSymbolicName, typeVersion, config) {
        let deferred = this.$q.defer();
        this.$http.get(`${this.host}/v1/catalog/types/${typeSymbolicName}/${typeVersion ? typeVersion : 'latest'}`, angular.extend({}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getTypeVersions(typeSymbolicName, config) {
        let deferred = this.$q.defer();
        this.$http.get(`${this.host}/v1/catalog/types/${typeSymbolicName}`, angular.extend({}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getBundleTypes(bundleSymbolicName, bundleVersion, config) {
        let deferred = this.$q.defer();
        this.$http.get(`${this.host}/v1/catalog/bundles/${bundleSymbolicName}/${bundleVersion}`, angular.extend({}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getBundleType(bundleSymbolicName, bundleVersion, typeSymbolicName, typeVersion, config) {
        let deferred = this.$q.defer();
        this.$http.get(`${this.host}/v1/catalog/bundles/${bundleSymbolicName}/${bundleVersion}/types/${typeSymbolicName}/${typeVersion ? typeVersion : 'latest'}`, angular.extend({}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    downloadBundle(bundleSymbolicName, bundleVersion, config) {
        const url = `${this.host}/v1/catalog/bundles/${bundleSymbolicName}/${bundleVersion}/download`;
        return config.urlOnly === true
            ? url
            : this.$http.get(`${this.host}/v1/catalog/bundles/${bundleSymbolicName}/${bundleVersion}/download`, angular.extend({}, config));
    }
}
