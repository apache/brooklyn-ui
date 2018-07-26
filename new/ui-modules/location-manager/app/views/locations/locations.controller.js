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
import uiRouter from 'angular-ui-router';
import brooklynApi from 'brooklyn-ui-utils/brooklyn.api/brooklyn.api';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import locationUtils from '../../components/location-utils/location-utils';
import {oldToCatalogLocation, transformResponse} from '../../components/transformers/locations.transformer';
import template from './locations.template.html';

const MODULE_NAME = 'state.locations';

angular.module(MODULE_NAME, [uiRouter, brooklynApi, locationUtils])
    .config(['$stateProvider', locationsStateConfig]);

export default MODULE_NAME;

export const locationsState = {
    name: 'locations',
    url: '/',
    controller: ['$scope', 'locations', locationsStateController],
    controllerAs: 'vm',
    template: template,
    resolve: {
        locations: ['catalogApi', 'locationApi', '$q', '$filter', function (catalogApi, locationApi, $q, $filter) {
            return $q.all([locationApi.getLocations(), catalogApi.getLocations({allVersions: 'true'}, {cache: null, transformResponse: transformResponse})]).then(function (result) {
                // result[0] are all locations coming from the old api. It includes the catalog locations.
                // result[1] are catalog locations
                let seenLocations = new Map();

                // This filters out the catalog locations
                return result[0].filter((oldLocation) => {
                    return !oldLocation.hasOwnProperty('catalog');
                })
                // Then we transform our old location into the same format as catalog locations
                    .map(oldToCatalogLocation)
                    // Then we concat the result with the catalog locations
                    .concat(result[1].filter((newLocation) => {
                        let prevLocation;

                        // Have we seen this location before?
                        if (seenLocations.has(newLocation.symbolicName)) {
                            // Yes, grab it and add this data to it
                            prevLocation = seenLocations.get(newLocation.symbolicName);
                            prevLocation.versions.push(newLocation.version);
                            // Don't keep this entry, we've merged it into the previous one
                            return false;
                        }

                        if (!Array.isArray(newLocation.versions)) {
                            newLocation.versions = [];
                        }

                        // Remember that we've seen it
                        seenLocations.set(newLocation.symbolicName, newLocation);

                        // Keep this one, we'll merge any others that match into it
                        return true;
                    }))
                    // Finally, we sort by name
                    .sort((a, b) => {
                        let nameA = $filter('locationName')(a);
                        let nameB = $filter('locationName')(b);
                        if (nameA < nameB) {
                            return -1;
                        }
                        if (nameA > nameB) {
                            return 1;
                        }
                        return 0;
                    })
            });
        }]
    }
};

export function locationsStateConfig($stateProvider) {
    $stateProvider.state(locationsState);
}

export function locationsStateController($scope, locations) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    $scope.locations = locations;
}
