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
const MODULE_NAME = 'inspector.providers.api.entity';

angular.module(MODULE_NAME, [])
    .provider('entityApi', entityApiProvider);

export default MODULE_NAME;

export function entityApiProvider() {
    return {
        $get: ['$http', '$q', function ($http, $q) {
            return new EntityApi($http, $q);
        }]
    };
}

function EntityApi($http, $q) {
    return {
        entity: getEntity,
        entityConfigInfo: getEntityConfigInfo,
        entityConfigState: getEntityConfigState,
        entitySpec: getEntitySpec,
        entitySpecList: getEntitySpecList,
        entitySensorsInfo: getEntitySensorsInfo,
        entitySensorsState: getEntitySensorsState,
        entitySensorValue: getEntitySensorValue,
        entityEffectors: getEntityEffectors,
        
        entityAdjuncts: getEntityAdjuncts,
        entityAdjunct: getEntityAdjunct,
        entityAdjunctConfigInfo: getEntityAdjunctConfigInfo,
        entityAdjunctConfigValue: getEntityAdjunctConfigValue,
        entityAdjunctActivities: getEntityAdjunctActivities,
        
        entityPolicies: getEntityPolicies,
        
        entityActivities: getEntityActivities,
        entityActivitiesDeep: getEntityActivitiesDeep,

        entityLocations: getEntityLocations,
        
        updateEntityName: updateEntityName,
        resetEntityProblems: resetEntityProblems,
        expungeEntity: expungeEntity,
        
        invokeEntityEffector: invokeEntityEffector,
        
        addEntityPolicy: addEntityPolicy,
        
        addEntityAdjunct: addEntityAdjunct,
        startEntityAdjunct: startEntityAdjunct,
        stopEntityAdjunct: stopEntityAdjunct,
        destroyEntityAdjunct: destroyEntityAdjunct,
        updateEntityAdjunctConfig: updateEntityAdjunctConfig
        
    };

    function getEntity(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId, {observable: true, ignoreLoadingBar: true});
    }
    function getEntityConfigInfo(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/config', {observable: true, ignoreLoadingBar: true});
    }

    function getEntityConfigState(applicationId, entityId, skipResolution) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + `/config/current-state?suppressSecrets=true&skipResolution=${!!skipResolution}`, {observable: true, ignoreLoadingBar: true});
    }
    function getEntitySpec(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/spec', {observable: true, ignoreLoadingBar: true});
    }
    function getEntitySpecList(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/speclist', {observable: true, ignoreLoadingBar: true});
    }
    function getEntitySensorsInfo(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/sensors', {observable: true, ignoreLoadingBar: true});
    }
    function getEntitySensorsState(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/sensors/current-state', {observable: true, ignoreLoadingBar: true});
    }
    function getEntitySensorValue(applicationId, entityId, sensorId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/sensors/' + sensorId, {observable: true, ignoreLoadingBar: true});
    }
    function getEntityEffectors(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/effectors', {observable: true, ignoreLoadingBar: true});
    }
    
    function getEntityAdjuncts(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/adjuncts', {observable: true, ignoreLoadingBar: true});
    }
    function getEntityAdjunct(applicationId, entityId, adjunctId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/adjuncts/' + adjunctId, {observable: true, ignoreLoadingBar: true});
    }
    function getEntityAdjunctActivities(applicationId, entityId, adjunctId) {
        return $http.get('/v1/applications/'+ applicationId +'/entities/' + entityId + '/adjuncts/' + adjunctId + '/activities', {observable: true, ignoreLoadingBar: true});
    }
    function getEntityAdjunctConfigInfo(applicationId, entityId, adjunctId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/adjuncts/' + adjunctId + '/config', {observable: true, ignoreLoadingBar: true});
    }
    function getEntityAdjunctConfigValue(applicationId, entityId, adjunctId, configId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/adjuncts/' + adjunctId + '/config/' + configId, {observable: true, ignoreLoadingBar: true, transformResponse: (data)=> {
            try {
                return angular.fromJson(data);
            } catch (e) {
                return data;
            }
        }});
    }
    
    function getEntityPolicies(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/policies', {observable: true, ignoreLoadingBar: true});
    }
    
    function getEntityActivities(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/activities', {observable: true, ignoreLoadingBar: true});
    }
    function getEntityActivitiesDeep(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/activities?recurse=true', {observable: true, ignoreLoadingBar: true});
    }

    function getEntityLocations(applicationId, entityId) {
        return $http.get('/v1/applications/' + applicationId + '/entities/' + entityId + '/locations', {observable: true, ignoreLoadingBar: true});
    }

    function updateEntityName(applicationId, entityId, entityName) {
        return $http.post('/v1/applications/' + applicationId + '/entities/' + entityId + '/name', {}, {
            params: {
                name: entityName
            }
        });
    }
    function resetEntityProblems(applicationId, entityId) {
        return $q.all([
            $http.post('/v1/applications/' + applicationId + '/entities/' + entityId + '/sensors/service.notUp.indicators', {}),
            $http.post('/v1/applications/' + applicationId + '/entities/' + entityId + '/sensors/service.problems', {})
        ]);
    }
    function expungeEntity(applicationId, entityId, release) {
        return $http.post('/v1/applications/' + applicationId + '/entities/' + entityId + '/expunge?release=' + release + '&timeout=0');
    }
    function invokeEntityEffector(applicationId, entityId, effectorId, params) {
        return $http.post('/v1/applications/' + applicationId + '/entities/' + entityId + '/effectors/' + effectorId + '?timeout=0', params);
    }
    
    function addEntityPolicy(applicationId, entityId, policyType, params) {
        return $http.post('/v1/applications/'+ applicationId +'/entities/' + entityId + '/policies/?type=' + policyType, params);
    }

    function addEntityAdjunct(applicationId, entityId, adjunctType, params) {
        return $http.post('/v1/applications/'+ applicationId +'/entities/' + entityId + '/adjuncts/?type=' + adjunctType, params);
    }
    function startEntityAdjunct(applicationId, entityId, adjunctId) {
        return $http.post('/v1/applications/'+ applicationId +'/entities/' + entityId + '/adjuncts/' + adjunctId + '/start');
    }
    function stopEntityAdjunct(applicationId, entityId, adjunctId) {
        return $http.post('/v1/applications/'+ applicationId +'/entities/' + entityId + '/adjuncts/' + adjunctId + '/stop');
    }
    function destroyEntityAdjunct(applicationId, entityId, adjunctId) {
        return $http.delete('/v1/applications/'+ applicationId +'/entities/' + entityId + '/adjuncts/' + adjunctId);
    }
    function updateEntityAdjunctConfig(applicationId, entityId, adjunctId, configId, data) {
        return $http.post('/v1/applications/'+ applicationId +'/entities/' + entityId + '/adjuncts/' + adjunctId + '/config/' + configId, data);
    }    
}