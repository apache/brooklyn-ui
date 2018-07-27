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
import {ErrorHandler, SuccessHandler} from './handlers'
import {ApplicationApi} from './application-api';

export function applicationApiProvider() {
    let cacheName = '$http';
    let host = '';
    let implementation = ApplicationApiProvider;

    return {
        cacheName: function (value) {
            cacheName = value;
        },
        host: function (value) {
            host = value;
        },
        implementation: function (impl) {
            if (!(impl.prototype === ApplicationApi.prototype)) {
                throw new Error(`Expected an implementation extending ${ApplicationApi} but got ${impl}`);
            }
            implementation = impl;
        },
        $get: ['$http', '$q', '$cacheFactory', function ($http, $q, $cacheFactory) {
            let cache = $cacheFactory.get(cacheName) || $cacheFactory(cacheName);
            return new implementation($http, $q, cache, host);
        }]
    };
}

class ApplicationApiProvider extends ApplicationApi {
    constructor($http, $q, cache, host) {
        super(cache, host);
        this.$http = $http;
        this.$q = $q;
    }

    createApplication(applicationSpec) {
        let deferred = this.$q.defer();
        this.$http({
            method: 'POST',
            url: `${this.host}/v1/applications`,
            data: applicationSpec,
            headers: {
                'Content-Type': 'application/yaml'
            }
        }).then(new SuccessHandler(deferred)).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }


    getApplication(id, clearCache) {
        let url = `${this.host}/v1/applications/${id}`;
        if (clearCache) {
            this.cache.remove(url);
        }
        let deferred = this.$q.defer();
        this.$http({
            method: 'GET',
            cache: this.cache,
            url: url
        }).then(new SuccessHandler(deferred)).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getEntity(applicationId, entityId, clearCache) {
        let url = `${this.host}/v1/applications/${applicationId}/entities/${entityId}`;
        if (clearCache) {
            this.cache.remove(url);
        }
        let deferred = this.$q.defer();
        this.$http({
            method: 'GET',
            cache: this.cache,
            url: url
        }).then(new SuccessHandler(deferred)).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getApplicationTree(id, clearCache) {
        if (clearCache) {
            this.cache.remove('/v1/applications/fetch?items=' + id);
        }
        let deferred = this.$q.defer();
        this.$http({
            method: 'GET',
            cache: this.cache,
            url: `${this.host}/v1/applications/fetch`,
            params: {
                items: id
            }
        }).then(function (response) {
            deferred.resolve(response.data[0]);
        }).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getChildEntities(applicationId, entityId, clearCache) {
        let url = `${this.host}/v1/applications/${applicationId}/entities/${entityId}/children`;
        if (clearCache) {
            this.cache.remove(url);
        }
        let deferred = this.$q.defer();
        this.$http({
            method: 'GET',
            cache: this.cache,
            url: url
        }).then(new SuccessHandler(deferred)).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getLink(link, clearCache) {
        if (clearCache) {
            this.cache.remove(link);
        }
        let deferred = this.$q.defer();
        this.$http({
            method: 'GET',
            cache: this.cache,
            url: link
        }).then(new SuccessHandler(deferred)).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }
}