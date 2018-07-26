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
import {SensorApi} from './sensor-api';

export function sensorApiProvider() {
    let cacheName = '$http';
    let host = '';
    let implementation = SensorApiProvider;

    return {
        cacheName: function (value) {
            cacheName = value;
        },
        host: function (value) {
            host = value;
        },
        implementation: function (impl) {
            if (!(impl.prototype === SensorApi.prototype)) {
                throw new Error(`Expected an implementation extending ${SensorApi} but got ${impl}`);
            }
            implementation = impl;
        },
        $get: ['$http', '$q', '$cacheFactory', function ($http, $q, $cacheFactory) {
            let cache = $cacheFactory.get(cacheName) || $cacheFactory(cacheName);
            return new implementation($http, $q, cache, host);
        }]
    };
}

class SensorApiProvider extends SensorApi {
    constructor($http, $q, cache, host) {
        super(cache, host);
        this.$http = $http;
        this.$q = $q;
    }

    getAllSensorsState(appId, entityId, clearCache) {
        let url = `${this.host}/v1/applications/${appId}/entities/${entityId}/sensors/current-state`;
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

    getSensorSpecs(appId, entityId, clearCache) {
        let url = `${this.host}/v1/applications/${appId}/entities/${entityId}/sensors`;
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
}