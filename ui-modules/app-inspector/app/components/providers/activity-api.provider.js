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
import angular from "angular";

const MODULE_NAME = 'inspector.providers.api.activity';

angular.module(MODULE_NAME, [])
    .provider('activityApi', activityApiProvider);

export default MODULE_NAME;

export function activityApiProvider() {
    return {
        $get: ['$http', function ($http) {
            return new ActivityApi($http);
        }]
    };
}

function ActivityApi($http) {
    return {
        activities: getActivities,
        activity: getActivity,
        activityChildren: getActivityChildren,
        activityDescendants: getActivityDescendants,
        activityStream: getActivityStream
    };

    function getActivities() {
        return $http.get('/v1/activities', {observable: true, ignoreLoadingBar: true});
    }
    function getActivity(activityId) {
        return $http.get('/v1/activities/' + activityId, {observable: true, ignoreLoadingBar: true});
    }
    function getActivityChildren(activityId) {
        return $http.get('/v1/activities/' + activityId + '/children?includeBackground=true', {observable: true, ignoreLoadingBar: true});
    }
    function getActivityDescendants(activityId, maxDepth) {
        return $http.get('/v1/activities/' + activityId + '/children/recurse'+
            (maxDepth ? '?maxDepth='+maxDepth : ''), {observable: true, ignoreLoadingBar: true});
    }
    function getActivityStream(activityId, streamType) {
        return $http.get('/v1/activities/' + activityId + '/stream/' + streamType, {observable: true, ignoreLoadingBar: true, transformResponse: (data)=> {
            try {
                return angular.fromJson(data);
            } catch (e) {
                return data;
            }
        }});
    }
}