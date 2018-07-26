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
import jsyaml from 'js-yaml';

export function oldToCatalogLocation(oldLocation) {
    return {
        symbolicName: oldLocation.name,
        name: oldLocation.config ? (oldLocation.config.displayName || oldLocation.config.name) : oldLocation.name,
        config: oldLocation.config,
        deprecated: oldLocation.config ? oldLocation.config.deprecated : false,
        id: oldLocation.id,
        type: oldLocation.id,
        spec: oldLocation.spec,
        readOnly: true
    };
}

export function transformResponse(data, headersGetter, status) {
    let json = angular.fromJson(data);
    if (status === 200) {
        if (angular.isArray(json)) {
            return json.map((value, key) => {
                return parseAndExtractYamlConfig(value);
            });
        } else if (angular.isObject(json)) {
            return parseAndExtractYamlConfig(json);
        }
    }
    return json;
}

export function parseAndExtractYamlConfig(json) {
    try {
        let doc = jsyaml.safeLoad(json.planYaml);
        json.spec = doc['brooklyn.locations'][0].type;
        json.config = doc['brooklyn.locations'][0]['brooklyn.config'];
        return json;
    } catch(ex) {
        return json;
    }
}