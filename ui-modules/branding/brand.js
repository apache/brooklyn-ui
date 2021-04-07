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
/* File where brands can provide JS extensions available as angular modules.
 * If supplied, they must supply all elements declared by the stock Brooklyn implementation.
 * It can be omitted from a brand.
 *
 * The entries returned by the `brBrandInfoProvider` here can be accessed in `brBrandInfo` by passing that module to an angular module.
 */

import angular from "angular";

const MODULE_NAME = 'brooklyn.brand.extensionPoint.default';

angular.module(MODULE_NAME, [])
    .factory('brBrandInfo', brBrandInfoProvider);

export default MODULE_NAME;

const BRAND_PROPS = __BRAND_PROPS__; //injected by webpack

export function brBrandInfoProviderDefault() {
    return {
        getVendorPackages: function() {
            return {
                'Java/Sun/Oracle': ['java', 'javax', 'sun', 'sunw', 'com.sun', 'com.oracle'],
                'Apache CXF': ['org.apache.cxf'],
                'Apache log4j': ['org.apache.log4j'],
                'Apache Brooklyn': ['org.apache.brooklyn', 'io.brooklyn'],
                'Apache': ['org.apache'],
                'slf4j': ['org.slf4j'],
                'Jetty': ['org.eclipse.jetty', 'org.mortbay'],
            };
        },
        getBrandedText: function (key, defaultValue) {
          return key.split('.').reduce(function(o, x) {
           return o ? o[x] : undefined;
          }, BRAND_PROPS);
        },
        getAppDeployedUrl: function (appId, entityId) {
            return '/brooklyn-ui-app-inspector/#!/application/' + appId + '/entity/' + entityId + '/summary';
        },
        blueprintComposerBaseUrl: '/brooklyn-ui-blueprint-composer/',
    };
}

export function brBrandInfoProvider() {
    // for extensions to customize
    return brBrandInfoProviderDefault();
}