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
import template from "./stream.template.html";

export const streamState = {
    name: 'main.inspect.activities.detail.stream',
    url: '/stream/:streamId',
    template: template,
    controller: ['$scope', '$stateParams', 'activityApi', streamController],
    controllerAs: 'vm',
};

export function streamController($scope, $stateParams, activityApi) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    const {
        activityId,
        streamId
    } = $stateParams;

    var vm = this;
    vm.model = {
        activityId: activityId,
        streamId: streamId,
        streamNotFound: false
    };

    let observers = [];

    activityApi.activity(activityId).then((response)=> {
        vm.model.activity = response.data;
        observers.push(response.subscribe((response)=> {
            vm.model.activity = response.data;
            vm.error = undefined;
        }, (response)=> {
            vm.error = 'Cannot load activity with ID: ' + activityId;
            vm.modal.streamNotFound = true;
        }));
    }).catch((error)=> {
        vm.error = 'Cannot load activity with ID: ' + activityId;
        vm.modal.streamNotFound = true;
    });

    $scope.$on('$destroy', ()=> {
        observers.forEach((observer)=> {
            observer.unsubscribe();
        });
    });
}
