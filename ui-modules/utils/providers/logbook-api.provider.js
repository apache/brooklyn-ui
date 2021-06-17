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
import {LogbookApi} from "./logbook-api";
import {ErrorHandler, SuccessHandler} from "./handlers";

export function logbookApiProvider() {
    let cacheName = '$http';
    let host = '';
    let implementation = LogbookApiProvider;

    return {
        cacheName: function (value) {
            cacheName = value;
        },
        host: function (value) {
            host = value;
        },
        implementation: function (impl) {
            if (!(impl.prototype === LogbookApi.prototype)) {
                throw new Error(`Expected an implementation extending ${LogbookApi} but got ${impl}`);
            }
            implementation = impl;
        },
        $get: ['$http', '$q', '$cacheFactory', function ($http, $q, $cacheFactory) {
            let cache = $cacheFactory.get(cacheName) || $cacheFactory(cacheName);
            return new implementation($http, $q, cache, host);
        }]
    };
}

class LogbookApiProvider extends LogbookApi {
    constructor($http, $q, cache, host) {
        super(cache, host);
        this.$http = $http;
        this.$q = $q;
    };

    logbookQuery(params, clearCache) {
        let url = `${this.host}/v1/logbook`;
        if (clearCache) {
            this.cache.remove(url);
        }
        let deferred = this.$q.defer();
        const data =  {
            "params": JSON.stringify(params) || ""
        };
        this.$http({
            method: 'POST',
            url: url,
            data: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Brooklyn-Allow-Non-Master-Access': 'true',
            }
        }).then(new SuccessHandler(deferred)).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    getEntries(from, numberOfLines, clearCache) {
        let url = `${this.host}/v1/logbook/getEntries?from=${from}&numberOfItems=${numberOfLines}`;
        if (clearCache) {
            this.cache.remove(url);
        }
        let deferred = this.$q.defer();
        this.$http({
            method: 'GET',
            url: url,
            headers: {
                'Accept': 'application/json',
                'Brooklyn-Allow-Non-Master-Access': 'true',
            }
        }).then(new SuccessHandler(deferred)).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }
}