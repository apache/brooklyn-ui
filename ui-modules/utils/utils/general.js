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

const MODULE_NAME = 'br.utils.general';

angular.module(MODULE_NAME, [])
    .factory("brUtilsGeneral", brUtilsGeneralProvider)
    .filter('capitalize', capitalizeFilter);

export default MODULE_NAME;

/* capitalizes the first word of a sentence or phrase */
export function capitalize(input) {
    return (!!input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
}

/* returns true if object is non-empty non-blank non-zero;
 * understands arrays and plain objects (keys), numbers, and booleans,
 * and anything with a length (string). also understands null and undefined.
 * 
 * useful instead of the refrain of (x!==null && x.length>0), or a bit worse for Object.
 */
export function isNonEmpty(object) {
    if (typeof object === "undefined" || object == null) return false;

    // treat arrays specially although I think the two methods below will always work for them
    if (Array.isArray(object)) return object.length > 0;

    if (angular.isObject(object)) return Object.keys(object).length > 0;

    // other common falsey types            
    if (object == 0 || object == false) return false;
    // strings, maybe other things
    if (object.hasOwnProperty("length")) return object.length > 0;

    // other objects will be complex or default to true
    return true;
}

export function uiModuleComparator(moduleA, moduleB) {
    if(moduleA.order && moduleB.order){
        if (moduleA.order != moduleB.order){
            return moduleA.order - moduleB.order;
        }
    }
    // If no order implemented or is the same, order by name
    return moduleA.name.localeCompare(moduleB.name);
}
export function brUtilsGeneralProvider() {
    return {
        isNonEmpty,
        capitalize,
        uiModuleComparator
    };
}

export function capitalizeFilter() {
    return function(input) {
        return capitalize(input);
    }
}
