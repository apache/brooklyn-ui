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
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import {managementState} from '../management.controller';
import template from './detail.template.html';

const MODULE_NAME = 'brooklyn.views.inspect.management.details';
const START_STOPPABLE_TYPES = [
    'policy',
    'feed'
    // TODO server should also support for enrichers
];

angular.module(MODULE_NAME, [])
    .filter('entityName', entityNameFilter)
    .filter('highlightLabel', highlightLabelFilter)
    .config(['$stateProvider', detailConfig]);

export default MODULE_NAME;

export const detailState = {
    name: 'main.inspect.management.detail',
    url: '/:adjunctId',
    template: template,
    controller: ['$scope', '$state', '$stateParams', 'entityApi', 'brSnackbar', detailController],
    controllerAs: 'vm'
};

export function detailController($scope, $state, $stateParams, entityApi, brSnackbar) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    const {
        applicationId,
        entityId,
        adjunctId
    } = $stateParams;

    let vm = this;
    let observers = [];

    vm.errors = {};
    vm.applicationId = applicationId;
    vm.entityId = entityId;
    vm.adjunctId = adjunctId;

    entityApi.entity(applicationId, entityId).then((response)=> {
        vm.entity = response.data;
        observers.push(response.subscribe((response)=> {
            vm.entity = response.data;
        }, (response)=> {
            vm.entityNotFound = true;
        }));
    }).catch((error)=> {
        vm.entityNotFound = true;
    });

    // copied from adjuncts-list.js
    function sortHighlights(highlights) {
        if (!highlights) return highlights;
        var result1 = [];
        for (var p in highlights) {
            var result1i = angular.copy(highlights[p]);
            result1i.id = p;
            result1i.display = "ITEM "+p;
            result1.push(result1i);
        }
        result1.sort(function(h1,h2) { return h2.time - h1.time; });
        var result2 = {};
        result1.forEach((x) => result2[x.id] = x);
        return result2;
    }

    entityApi.entityAdjunct(applicationId, entityId, adjunctId).then((response)=> {
        vm.adjunct = response.data;
        vm.highlights = sortHighlights(vm.adjunct.highlights);
        vm.errors.adjunct = undefined;
        observers.push(response.subscribe((response)=> {
            vm.adjunct = response.data;
            vm.highlights = sortHighlights(vm.adjunct.highlights);
            vm.errors.adjunct = undefined;
        }));
    }).catch((error)=> {
        vm.errors.adjunct = 'Cannot load adjunct with ID: ' + adjunctId;
    });

    entityApi.entityAdjunctActivities(applicationId, entityId, adjunctId).then((response)=> {
        vm.activities = response.data;
        vm.errors.activities = undefined;
        observers.push(response.subscribe((response)=> {
            vm.activities = response.data;
            vm.errors.activities = undefined;
        }));
    }).catch((error)=> {
        vm.errors.activities = 'Cannot load activities for adjunct with ID: ' + adjunctId;
    });

    vm.isStartStoppable = () => {
        var type = vm.adjunct.adjunctType || 'policy';
        return angular.isString(type) && START_STOPPABLE_TYPES.includes(type.toLowerCase());
    };

    vm.startAdjunct = function () {
        entityApi.startEntityAdjunct(applicationId, entityId, adjunctId).then((response)=> {
            brSnackbar.create(vm.adjunct.name + ' started successfully');
            vm.adjunct.state = 'RUNNING';
        }).catch((error)=> {
            brSnackbar.create('Cannot start ' + vm.adjunct.name + ': ' + error.data.message);
        });
    };

    vm.stopAdjunct = function () {
        entityApi.stopEntityAdjunct(applicationId, entityId, adjunctId).then((response)=> {
            brSnackbar.create(vm.adjunct.name + ' stopped successfully');
            vm.adjunct.state = 'STOPPED';
        }).catch((error)=> {
            brSnackbar.create('Cannot stop ' + vm.adjunct.name + ': ' + error.data.message);
        });
    };

    vm.destroyAdjunct = function () {
        entityApi.destroyEntityAdjunct(applicationId, entityId, adjunctId).then((response)=> {
            brSnackbar.create(vm.adjunct.name + ' destroyed successfully');
            $state.go(managementState, {applicationId: applicationId, entityId: entityId});
        }).catch((error)=> {
            brSnackbar.create('Cannot destroy ' + vm.adjunct.name + ': ' + error.data.message);
        });
    };

    $scope.$on('$destroy', ()=> {
        observers.forEach((observer)=> {
            observer.unsubscribe();
        });
    });
}

export function entityNameFilter() {
    return function (input) {
        if (input) {
            return input.name || input.symbolicName || input.type || '';
        }
        return '';
    }
}

export function highlightLabelFilter() {
    return function (input) {
        if (input) {
            switch (input) {
                case 'lastConfirmation':
                    return 'Last confirmation';
                case 'lastAction':
                    return 'Last action';
                case 'lastViolation':
                    return 'Last violation';
                case 'trigger':
                    return 'Trigger';
                default:
                    return input;
            }
        }
    }
}

export function detailConfig($stateProvider) {
    $stateProvider.state(detailState);
}
