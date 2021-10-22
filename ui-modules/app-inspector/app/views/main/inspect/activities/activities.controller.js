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
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from "./activities.template.html";
import modalTemplate from './kilt.modal.template.html';

export const activitiesState = {
    name: 'main.inspect.activities',
    url: '/activities',
    template: template,
    controller: ['$scope', '$state', '$stateParams', '$log', '$timeout', 'entityApi', 'brUtilsGeneral', ActivitiesController],
    controllerAs: 'vm'
};

function ActivitiesController($scope, $state, $stateParams, $log, $timeout, entityApi, Utils) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    const {
        applicationId,
        entityId
    } = $stateParams;

    let vm = this;

    let observers = [];

    vm.modalTemplate = modalTemplate;

    vm.isNonEmpty = Utils.isNonEmpty;

    vm.wideKilt = false;
    vm.setWideKilt = function (newValue) {
        vm.wideKilt = newValue;
        // empirically delay of 100ms means it runs after the resize;
        // seems there is no way to hook in to resize events so it is
        // either this or a $scope.$watch with very low interval
        $timeout(function() { $scope.$broadcast('resize') }, 100);
    };

    onStateChange();
    $scope.$on('$stateChangeSuccess', (event, toState, toParams, fromState, fromParams, options)=> {
        // as the below only runs if we are the active state, we need to check
        // if we switch from child state to us and we haven't been initialized
        onStateChange();
    })

    function onStateChange() {
      if ($state.current.name === activitiesState.name && !vm.activities) {
        // only run if we are the active state
        entityApi.entityActivities(applicationId, entityId).then((response) => {
            vm.activities = response.data;
            observers.push(response.subscribe((response) => {
                vm.activities = response.data;
                vm.error = undefined;
            }));
        }).catch((error) => {
            $log.warn('Error loading activity for '+activityId, error);
            vm.error = 'Cannot load activities for entity with ID: ' + entityId;
        });
        
        entityApi.entityActivitiesDeep(applicationId, entityId).then((response) => {
            vm.activitiesDeep = response.data;
            observers.push(response.subscribe((response) => {
                vm.activitiesDeep = response.data;
                vm.error = undefined;
            }));
        }).catch((error) => {
            $log.warn('Error loading activity children deep for '+activityId, error);
            vm.error = 'Cannot load activities (deep) for entity with ID: ' + entityId;
        });

        $scope.$on('$destroy', () => {
            observers.forEach((observer) => {
                observer.unsubscribe();
            });
        });
      }
    }

    vm.onFilteredActivitiesChange = function (newActivities) {
        vm.focusedActivities = newActivities;
    }
}
