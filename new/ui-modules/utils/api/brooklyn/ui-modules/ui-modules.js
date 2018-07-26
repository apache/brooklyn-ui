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
import {ErrorHandler, SuccessHandler} from '../../../providers/handlers';

const MODULE_NAME = 'brooklyn.utils.api.br-modules.ui-modules';

angular.module(MODULE_NAME, [])
    .provider('brooklynUiModulesApi', brooklynUiModulesApiProvider);

export default MODULE_NAME;

export function brooklynUiModulesApiProvider() {
    let cacheName = '$http';

    return {
        cacheName: function (value) {
            cacheName = value;
        },
        $get: ['$http', '$q', '$cacheFactory', function ($http, $q, $cacheFactory) {
            let cache = $cacheFactory.get(cacheName) || $cacheFactory(cacheName);
            return new UiModulesApi($http, $q, cache);
        }]
    };
}

function UiModulesApi($http, $q, cache) {
    this.getUiModules = getUiModules;

    function getUiModules(config) {
        let deferred = $q.defer();
        $http.get('/v1/ui-module-registry', angular.extend({cache: cache}, config))
            .then(new SuccessHandler(deferred))
            .catch(new ErrorHandler(deferred));
        return deferred.promise;
    }
}
