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
import {graphicalEditEntityState} from './edit/entity/edit.entity.controller';
import {graphicalEditPolicyState} from './edit/policy/edit.policy.controller';
import {graphicalEditEnricherState} from './edit/enricher/edit.enricher.controller';
import {Entity, EntityFamily} from '../../../components/util/model/entity.model';
import template from './graphical.state.html';

export const graphicalState = {
    name: 'main.graphical',
    url: 'graphical',
    templateProvider: function(composerOverrides) {
        return composerOverrides.paletteGraphicalStateTemplate || template;
    },
    controller: ['$scope', '$state', 'blueprintService', 'paletteService', graphicalController],
    controllerAs: 'vm',
    data: {
        label: 'Graphical Designer'
    }
};

function graphicalController($scope, $state, blueprintService, paletteService) {
    this.EntityFamily = EntityFamily;

    this.sections = paletteService.getSections();
    this.selectedSection = Object.values(this.sections).find(section => section.type === EntityFamily.ENTITY);
    $scope.paletteState = {};  // share state among all sections

    this.onTypeSelected = (selectedType)=> {
        let rootEntity = blueprintService.get();

        if (selectedType.supertypes.includes(EntityFamily.ENTITY.superType)) {
            let newEntity = blueprintService.populateEntityFromApi(new Entity(), selectedType);
            rootEntity.addChild(newEntity);
            blueprintService.refreshEntityMetadata(newEntity, EntityFamily.ENTITY).then(() => {
                $state.go(graphicalEditEntityState, {entityId: newEntity._id});
            })
        }
        else if (selectedType.supertypes.includes(EntityFamily.POLICY.superType)) {
            let newPolicy = blueprintService.populateEntityFromApi(new Entity(), selectedType);
            rootEntity.addPolicy(newPolicy);
            blueprintService.refreshEntityMetadata(newPolicy, EntityFamily.POLICY).then(() => {
                $state.go(graphicalEditPolicyState, {entityId: rootEntity._id, policyId: newPolicy._id});
            });
        }
        else if (selectedType.supertypes.includes(EntityFamily.ENRICHER.superType)) {
            let newEnricher = blueprintService.populateEntityFromApi(new Entity(), selectedType);
            rootEntity.addEnricher(newEnricher);
            blueprintService.refreshEntityMetadata(newEnricher, EntityFamily.ENRICHER).then(() => {
                $state.go(graphicalEditEnricherState, {entityId: rootEntity._id, enricherId: newEnricher._id});
            });
        }
        else if (selectedType.supertypes.includes(EntityFamily.LOCATION.superType)) {
            blueprintService.populateLocationFromApi(rootEntity, selectedType);
            $state.go(graphicalEditEntityState, {entityId: rootEntity._id});
        }
    };
}
