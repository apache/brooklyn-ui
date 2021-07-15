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
const MODULE_NAME = 'inspector.providers.api.application';

angular.module(MODULE_NAME, [])
    .provider('applicationApi', applicationApiProvider);

export default MODULE_NAME;

export function applicationApiProvider() {
    return {
        $get: ['$http', function ($http) {
            return new ApplicationApi($http);
        }]
    };
}

function ApplicationApi($http) {
    return {
        applications: getApplications,
        applicationsTree: getApplicationsTree,
        application: getApplication
    };

    function getApplications() {
        return $http.get('/v1/applications', {observable: true, ignoreLoadingBar: true});
    }
    function getApplicationsTree(opts = {}) {
        return $http.get('/v1/applications/fetch', {params: opts, observable: true, ignoreLoadingBar: true});
    }
    function getApplication(applicationId) {
        return $http.get('/v1/applications/' + applicationId, {observable: true, ignoreLoadingBar: true});
    }
}