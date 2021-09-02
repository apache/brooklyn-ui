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

const MODULE_NAME = 'brooklyn.utils.api.brooklyn.server';

angular.module(MODULE_NAME, [])
    .provider('serverApi', serverApiProvider);

export default MODULE_NAME;

export function serverApiProvider() {
    let cacheName = '$http';

    return {
        cacheName: function (value) {
            cacheName = value;
        },
        $get: ['$http', '$cacheFactory', ($http, $cacheFactory) => {
            let cache = $cacheFactory.get(cacheName) || $cacheFactory(cacheName);
            return new ServerApi($http, cache);
        }]
    };
}

function ServerApi($http, $q, cache) {
    this.getVersion = getVersion;
    this.getUser = getUser;
    this.getHaStates = getHaStates;
    this.getUpExtended = getUpExtended;

    this.setHaStatus = setHaStatus;
    this.setHaPriority = setHaPriority;
    this.removeHaTerminatedNodes = removeHaTerminatedNodes;
    this.removeHaTerminatedNode = removeHaTerminatedNode;

    this.importPersistenceData = importPersistenceData;

    function getVersion(config) {
        return $http.get('/v1/server/version', angular.extend({cache: cache}, config));
    }

    function getUser(config) {
        return $http.get('/v1/server/user', angular.extend({cache: cache}, config));
    }

    function getHaStates(config) {
        return $http.get('/v1/server/ha/states', angular.extend({cache: cache}, config));
    }

    function getUpExtended(config) {
        return $http.get('/v1/server/up/extended', angular.extend({cache: cache}, config));
    }

    function setHaStatus(state) {
        return $http({
            method: 'POST',
            url: '/v1/server/ha/state',
            data: 'mode=' + state,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'Brooklyn-Allow-Non-Master-Access': 'true',
            }

        });
    }

    function setHaPriority(priority) {
        return $http({
            method: 'POST',
            url: '/v1/server/ha/priority',
            data: 'priority=' + priority,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'Brooklyn-Allow-Non-Master-Access': 'true',
            }

        });
    }

    function removeHaTerminatedNodes(config){
        return $http.post('/v1/server/ha/states/clear', angular.extend({cache: cache}, config));
    }

    function removeHaTerminatedNode(nodeId){
        return $http({
            method: 'POST',
            url: '/v1/server/ha/states/clear/node',
            data: 'nodeId=' + nodeId,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'Brooklyn-Allow-Non-Master-Access': 'true',
            }

        });
    }

    function importPersistenceData(data, opts) {
        return $http.post('v1/server/ha/persist/import', data, opts);
    }
}
