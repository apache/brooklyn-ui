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
import {graphicalEditEntityState} from '../entity/edit.entity.controller';
import {graphicalEditSpecState} from '../spec/edit.spec.controller';
import {graphicalEditPolicyState} from '../policy/edit.policy.controller';
import {graphicalEditEnricherState} from '../enricher/edit.enricher.controller';
import {Entity, EntityFamily} from '../../../../../components/util/model/entity.model';
import template from './add.html';

export const graphicalEditAddState = {
    name: 'main.graphical.edit.add',
    url: '/add/:family?configKey',
    template: template,
    controller: ['$scope', '$filter', '$state', '$stateParams', 'blueprintService', GraphicalEditAddController],
    controllerAs: 'vm',
};

export function GraphicalEditAddController($scope, $filter, $state, $stateParams, blueprintService) {
    switch ($stateParams.family) {
        case EntityFamily.ENTITY.id.toLowerCase():
            $scope.family = EntityFamily.ENTITY;
            break;
        case EntityFamily.SPEC.id.toLowerCase():
            $scope.family = EntityFamily.SPEC;
            $scope.configKey = $stateParams.configKey;
            break;
        case EntityFamily.POLICY.id.toLowerCase():
            $scope.family = EntityFamily.POLICY;
            break;
        case EntityFamily.ENRICHER.id.toLowerCase():
            $scope.family = EntityFamily.ENRICHER;
            break;
        case EntityFamily.LOCATION.id.toLowerCase():
            $scope.family = EntityFamily.LOCATION;
            break;
    }

    $scope.getParentLink = ()=> {
        let state = graphicalEditEntityState;
        let params = {entityId: $scope.entity.hasParent() ? $scope.entity.parent._id : $scope.entity._id};
        if ($scope.entity.hasParent() && $scope.entity.parent.family === EntityFamily.SPEC) {
            state = graphicalEditSpecState;
            params = {entityId: $scope.entity.parent.parent._id, specId: $scope.entity.parent._id};
        }

        // We have a family, this means we are currently displaying the catalog selector
        if ($scope.family) {
            params = {entityId: $scope.entity._id};
            if ($scope.entity.family === EntityFamily.SPEC) {
                state = graphicalEditSpecState;
                params = {entityId: $scope.entity.parent._id, specId: $scope.entity._id};
            }
        }

        return $state.href(state, params);
    };

    $scope.getParentLinkLabel = ()=> {
        let label = $filter('entityName')($scope.entity.parent) || 'New application';

        if ($scope.family) {
            label = $filter('entityName')($scope.entity) || 'New application';
        }

        return label;
    };

    $scope.onTypeSelected = (type)=> {
        switch ($scope.family) {
            case EntityFamily.ENTITY:
                let newEntity = blueprintService.populateEntityFromApi(new Entity(), type);
                $scope.entity.addChild(newEntity);
                blueprintService.refreshEntityMetadata(newEntity, EntityFamily.ENTITY).then(() => {
                    $state.go(graphicalEditEntityState, {entityId: newEntity._id});
                });
                break;
            case EntityFamily.SPEC:
                let newSpec = blueprintService.populateEntityFromApi(new Entity(), type);
                $scope.entity.setClusterMemberspecEntity($scope.configKey, newSpec);
                blueprintService.refreshEntityMetadata(newSpec, EntityFamily.ENTITY).then(() => {
                    $state.go(graphicalEditSpecState, {specId: newSpec._id});
                });
                break;
            case EntityFamily.POLICY:
                let newPolicy = blueprintService.populateEntityFromApi(new Entity(), type);
                $scope.entity.addPolicy(newPolicy);
                blueprintService.refreshEntityMetadata(newPolicy, EntityFamily.POLICY).then(() => {
                    $state.go(graphicalEditPolicyState, {entityId: $scope.entity._id, policyId: newPolicy._id});
                });
                break;
            case EntityFamily.ENRICHER:
                let newEnricher = blueprintService.populateEntityFromApi(new Entity(), type);
                $scope.entity.addEnricher(newEnricher);
                blueprintService.refreshEntityMetadata(newEnricher, EntityFamily.ENRICHER).then(() => {
                    $state.go(graphicalEditEnricherState, {entityId: $scope.entity._id, enricherId: newEnricher._id});
                });
                break;
            case EntityFamily.LOCATION:
                blueprintService.populateLocationFromApi($scope.entity, type);
                $state.go(graphicalEditEntityState, {entityId: $scope.entity._id});
                break;
        }
    };
}
