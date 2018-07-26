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
import {SuccessHandler, ErrorHandler} from '../../providers/handlers';

const MODULE_NAME = 'brooklyn.utils.api.brooklyn.script';

angular.module(MODULE_NAME, [])
    .provider('scriptApi', scriptApiProvider);

export default MODULE_NAME;

export function scriptApiProvider() {
    let cacheName = '$http';

    return {
        cacheName: function (value) {
            cacheName = value;
        },
        $get: ['$http', '$q', '$cacheFactory', function ($http, $q, $cacheFactory) {
            let cache = $cacheFactory.get(cacheName) || $cacheFactory(cacheName);
            return new ScriptApi($http, $q, cache);
        }]
    };
}

function ScriptApi($http, $q, cache) {
    this.invalidateCache = invalidateCache;
    this.runGroovyScript = runGroovyScript;

    function runGroovyScript(groovyScript) {
        let deferred = $q.defer();
        $http({
            method: 'POST',
            url: '/v1/script/groovy',
            data: groovyScript,
            headers: {
                'Content-Type': 'application/text',
                'Brooklyn-Allow-Non-Master-Access': 'true',
            }
        }).then(new SuccessHandler(deferred)).catch(new ErrorHandler(deferred));
        return deferred.promise;
    }

    function invalidateCache() {
        cache.removeAll();
    }
}
