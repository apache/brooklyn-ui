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
import {signatureOf} from '../../../../util/change-detection.util';
import template from "./sensors.template.html";

export const sensorsState = {
    name: 'main.inspect.sensors',
    url: '/sensors',
    template: template,
    controller: ['$scope', '$stateParams', 'entityApi', sensorsController],
    controllerAs: 'vm'
};

function sensorsController($scope, $stateParams, entityApi) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    const {
        applicationId,
        entityId
    } = $stateParams;

    let vm = this;
    vm.error = {};

    let observers = [];

    vm.reconfigureCallback = () => {
        // TODO - do we want to support reconfiguration in sensors?
        // Currently out of scope
    }

    let lastSensorsData = null;
    entityApi.entitySensorsState(applicationId, entityId).then((response)=> {
        lastSensorsData = signatureOf(response.data);
        vm.sensors = response.data;
        vm.error.sensors = undefined;
        observers.push(response.subscribe((response)=> {
            const newData = signatureOf(response.data);
            if (newData !== lastSensorsData) {
                lastSensorsData = newData;
                vm.sensors = response.data;
            }
            vm.error.sensors = undefined;
        }));
    }).catch((error)=> {
        vm.error.sensors =  'Cannot load sensors for entity with ID: ' + entityId;
    });

    let lastSensorsInfoData = null;
    entityApi.entitySensorsInfo(applicationId, entityId).then((response)=> {
        lastSensorsInfoData = signatureOf(response.data);
        vm.sensorsInfo = response.data;
        vm.error.sensors = undefined;
        observers.push(response.subscribe((response)=> {
            const newData = signatureOf(response.data);
            if (newData !== lastSensorsInfoData) {
                lastSensorsInfoData = newData;
                vm.sensorsInfo = response.data;
            }
            vm.error.sensors = undefined;
        }));
    }).catch((error)=> {
        vm.error.sensors =  'Cannot load sensors for entity with ID: ' + entityId;
    });

    $scope.$on('$destroy', ()=> {
        observers.forEach((observer)=> {
            observer.unsubscribe();
        });
    });
}
