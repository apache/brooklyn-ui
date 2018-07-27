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

export function GraphicalEditController($scope, entity) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    $scope.entity = entity;
}

export const graphicalEditState = {
    abstract: true,
    name: 'main.graphical.edit',
    url: '/:entityId',
    template: '<ui-view></ui-view>',
    controller: ['$scope', 'entity', GraphicalEditController],
    controllerAs: 'vm',
    resolve: {
        entity: ['$q', '$stateParams', 'blueprintService', function ($q, $stateParams, blueprintService) {
            let defer = $q.defer();
            let entity = blueprintService.find($stateParams.entityId);
            if (entity) {
                defer.resolve(entity);
            } else {
                defer.reject('No entity with id [' + $stateParams.entityId + '] found');
            }
            return defer.promise;
        }]
    }
};
