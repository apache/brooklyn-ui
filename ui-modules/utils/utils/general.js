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
    .factory("brUtilsGeneral", brUtilsGeneralFactory)
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
export function brUtilsGeneralFactory() {
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

const TOLERANCE = 0.0000000001;

export function isEqualWithinTolerance(n, n2, tolerance) {
    return Math.abs(n2 - n)<(tolerance||TOLERANCE);
}

export function isInteger(n) {
    return isEqualWithinTolerance(n, Math.round(n));
}

/** returns number rounded as first arg, and actual number of decimal places populated as second */
function roundNumericWithPlaces(n, maxDecimalDigits, minDecimalDigits, onlyCountSignificantDecimalDigits, countNines) {
    maxDecimalDigits = maxDecimalDigits || 0;
    minDecimalDigits = minDecimalDigits || 0;
    if (countNines) n = 1-n;

    // one recommended way to round; but seems inefficient using strings, causes round(0.499, 2) to show 0.5 not 0.50, and doesn't deal with significant decimal digits
    // return Number(Math.round(Number(''+n+'e'+maxDecimalDigits))+'e-'+maxDecimalDigits);

    let placesToShow = 0;
    let significantPlaces = 0;
    for (;;) {
        if (isInteger(n)) break;
        n *= 10;
        if (onlyCountSignificantDecimalDigits && !significantPlaces) {
            if (isEqualWithinTolerance(n, 0, 1)) {
                // accept an extra digit if we are still dealing with insignificant digits
                significantPlaces--;
            }
        }
        significantPlaces++;
        placesToShow++;
        if (significantPlaces >= maxDecimalDigits && significantPlaces>0 && placesToShow>=minDecimalDigits) break;
    }
    let nr = Math.round(n);
    if (!maxDecimalDigits && placesToShow > significantPlaces) {
        // if no decimal digits but significant places then keep the right number of zeroes/ones
        nr = Math.round(nr/10);
        placesToShow--;
    }
    let i = placesToShow;
    while (i-->0) nr/=10;
    if (countNines) nr = 1-nr;
    return [nr, Math.max(placesToShow, minDecimalDigits)];
}

/** rounds up to a given number of places after the decimal point;
 * but unlike Number.toFixed if the number is exact, it does not create needless trailing zeros.
 * so eg round(0.501, 2) will give 0.50 but round(0.50, 2) will give 0.5.
 *
 * optionally only counts significant digits, which ignores leading zeroes, so eg
 * whereas round(0.00123, 2) would give 0.00, round(0.00123, 2, true) would give 0.0012.
 * (this is especially useful when rounding nines).
 */
export function round(n, maxDecimalDigits, onlyCountSignificantDecimalDigits) {
    const [number, places] = roundNumericWithPlaces(n, maxDecimalDigits, 0, onlyCountSignificantDecimalDigits, false);
    return number;
}

/** as round, but returning a string */
export function rounded(n, maxDecimalDigits, onlyCountSignificantDecimalDigits) {
    const [number, places] = roundNumericWithPlaces(n, maxDecimalDigits, 0, onlyCountSignificantDecimalDigits, false);
    return number.toFixed(places);
}
