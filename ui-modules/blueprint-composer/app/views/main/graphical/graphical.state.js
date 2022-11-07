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
import {computeQuickFixes} from '../../../components/quick-fix/quick-fix';
import {Entity, EntityFamily} from '../../../components/util/model/entity.model';
import template from './graphical.state.html';

const SESSION_KEYS = {
    SECTION: 'composerSection',
}

export const graphicalState = {
    name: 'main.graphical',
    url: '/graphical',
    templateProvider: function(composerOverrides) {
        return composerOverrides.paletteGraphicalStateTemplate || template;
    },
    controller: ['$scope', '$state', '$filter', 'blueprintService', 'paletteService', graphicalController],
    controllerAs: 'vm',
    data: {
        label: 'Graphical Designer'
    }
};

function graphicalController($scope, $state, $filter, blueprintService, paletteService) {
    let vm = this;
    this.EntityFamily = EntityFamily;

    this.sections = paletteService.getSections();
    const savedSectionId = sessionStorage.getItem(SESSION_KEYS.SECTION);
    this.selectedSection = Object.values(this.sections)
        .find(section => section.type.id === (savedSectionId || EntityFamily.ENTITY.id));
    $scope.paletteState = {};  // share state among all sections
    $scope.errorsPane = { level: null };

    $scope.blueprint = blueprintService.get();
    $scope.$watch('blueprint', () => vm.computeIssues(), true);
    // thought these might be needed to ensure errors are set, but seems not to be the case, above seems sufficient
    //blueprintService.refreshBlueprintMetadata().then(()=> vm.computeIssues());
    //$scope.$watch('blueprint.lastUpdated', () => vm.computeIssues(), true);

    this.computeIssues = () => {
        $scope.allIssues = computeQuickFixes(blueprintService);
    }
    this.onSectionSelection = (section) => {
        vm.selectedSection = section;
        sessionStorage.setItem(SESSION_KEYS.SECTION, section.type.id);
    }
    this.onCanvasSelection = (item) => {
        $scope.canvasSelectedItem = item;
    }
    this.size = (obj) => {
        if (!obj) return 0;
        return Object.keys(obj).length;
    }

    this.messageNeedsPrefix = (itemV) => !itemV.message || (""+itemV.message).indexOf(itemV.ref)<0;
    this.entitySummary = (entity) => {
        return entity.id
            ? entity.id + (entity.type ? ' ('+entity.type+')' : '')
            : entity.name ? entity.name + (entity.type ? ' ('+entity.type+')' : '')
            : entity.type ? entity.type + ' ('+entity._id+')'
            : entity._id;
    };
    this.getOnSelectText = (selectableType) => $scope.canvasSelectedItem ? "Add to " + $filter('entityName')($scope.canvasSelectedItem) : "Add to application";
    
    this.addSelectedTypeToTargetEntity = (selectedType, targetEntity) => {
        if (!targetEntity) targetEntity = $scope.canvasSelectedItem;
        if (!targetEntity) targetEntity = blueprintService.get();

        if (selectedType.supertypes.includes(EntityFamily.ENTITY.superType)) {
            let newEntity = blueprintService.populateEntityFromApi(new Entity(), selectedType);
            targetEntity.addChild(newEntity);
            blueprintService.refreshEntityMetadata(newEntity, EntityFamily.ENTITY).then(() => {
                $state.go(graphicalEditEntityState, {entityId: newEntity._id});
            })
        }
        else if (selectedType.supertypes.includes(EntityFamily.POLICY.superType)) {
            let newPolicy = blueprintService.populateEntityFromApi(new Entity(), selectedType);
            targetEntity.addPolicy(newPolicy);
            blueprintService.refreshEntityMetadata(newPolicy, EntityFamily.POLICY).then(() => {
                $state.go(graphicalEditPolicyState, {entityId: targetEntity._id, policyId: newPolicy._id});
            });
        }
        else if (selectedType.supertypes.includes(EntityFamily.ENRICHER.superType)) {
            let newEnricher = blueprintService.populateEntityFromApi(new Entity(), selectedType);
            targetEntity.addEnricher(newEnricher);
            blueprintService.refreshEntityMetadata(newEnricher, EntityFamily.ENRICHER).then(() => {
                $state.go(graphicalEditEnricherState, {entityId: targetEntity._id, enricherId: newEnricher._id});
            });
        }
        else if (selectedType.supertypes.includes(EntityFamily.LOCATION.superType)) {
            blueprintService.populateLocationFromApi(targetEntity, selectedType);
            $state.go(graphicalEditEntityState, {entityId: targetEntity._id});
        }
    };

    this.applyQuickFix = (fix) => {
        fix.issues.forEach(issue => fix.apply(issue));
        // recompute errors
        blueprintService.clearAllIssues();
        blueprintService.refreshBlueprintMetadata()
    }
}
