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

const MODULE_NAME = 'brooklyn.filters.entity';

angular.module(MODULE_NAME, [])
    .filter('entityName', entityNameFilter)
    .filter('entityVersion', entityVersionFilter)
    .filter('entityTypes', entityTypesFilter);

export default MODULE_NAME;

export function entityNameFilter() {
    return function (input) {
        var result = input ? (input.displayName || input.name || input.symbolicName || input.type || null) : null;
        if (!result) {
            if (input && !input.parent) result = 'Application';
            else result = 'Unnamed entity';
        }
        if (result.match(/^[^\w]*deprecated[^\w]*/i)) {
            result = result.replace(/^[^\w]*deprecated[^\w]*/i, '');
        }
        return result;
    }
}

export function entityVersionFilter() {
    return function (input) {
        let latest = 'Latest version';
        if (input) {
            return input.hasVersion() ? input.version : latest;
        }
        return latest;
    }
}

export function entityTypesFilter($filter) {
    return function (input, search) {
        return input.then(function (response) {
            var filtered = response.filter(function (entity) {
                var name = $filter('entityName')(entity);
                return name ? name.toLowerCase().indexOf(search.toLowerCase()) > -1 : false;
            }).sort(function (left, right) {
                var nameLeft = $filter('entityName')(left);
                var nameRight = $filter('entityName')(right);
                return nameLeft.localeCompare(nameRight);
            });
            return filtered;
        }).catch(function (err) {
            return [];
        });
    }
}