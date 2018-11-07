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
import {Entity} from "../util/model/entity.model";
import {D3BlueprintMgmtView} from "../util/d3-blueprint-mgmt-view";
import {D3BlueprintLandscapeView} from "../util/d3-blueprint-landscape-view";
import {EntityFamily} from '../util/model/entity.model';
import {graphicalEditEntityState} from '../../views/main/graphical/edit/entity/edit.entity.controller';
import {graphicalEditSpecState} from '../../views/main/graphical/edit/spec/edit.spec.controller';
import {graphicalEditPolicyState} from '../../views/main/graphical/edit/policy/edit.policy.controller';
import {graphicalEditEnricherState} from '../../views/main/graphical/edit/enricher/edit.enricher.controller';
const ANY_MEMBERSPEC_REGEX = /(^.*[m,M]ember[s,S]pec$)/;
const TAG = 'DIRECTIVE :: DESIGNER :: ';

export function designerDirective($log, $state, $q, iconGenerator, catalogApi, blueprintService, brSnackbar, paletteDragAndDropService) {
    let directive = {
        restrict: 'E',
        scope: {
            mode: '@?',
            onSelectionChange: '<?'
        },
        template: '',
        link: link
    };
    return directive;

    function link($scope, $element) {
        let blueprintGraph = $scope.mode=='landscape' ? new D3BlueprintLandscapeView($element[0]) : new D3BlueprintMgmtView($element[0]);
        blueprintGraph.center();

        $scope.blueprint = blueprintService.get();
        $scope.$watch('blueprint', ()=> {
            redrawGraph();
        }, true);

        blueprintService.refreshBlueprintMetadata().then(()=>{
            redrawGraph();
        });

        $scope.selectedEntity = null;

        $scope.$on('d3.redraw', (event, initial)=> {
            $log.debug(TAG + 'Re-draw blueprint, triggered by ' + event.name, $scope.blueprint);

            blueprintService.refreshBlueprintMetadata().then(()=>{
                redrawGraph();
                if (initial) {
                    blueprintGraph.center();
                }
            });
        });

        $scope.$on('d3.remove', (event, entity)=> {
            $log.debug(TAG + `Delete ${entity.family.displayName} ${entity._id}`, entity);

            let relationships = blueprintService.getRelationships().filter((relation)=>(relation.target === entity));

            switch (entity.family) {
                case EntityFamily.ENTITY:
                    entity.delete();
                    break;
                case EntityFamily.POLICY:
                    entity.parent.removePolicy(entity._id);
                    break;
                case EntityFamily.ENRICHER:
                    entity.parent.removeEnricher(entity._id);
                    break;
                case EntityFamily.SPEC:
                    let memberSpecMap = entity.parent.getClusterMemberspecEntities();
                    Object.keys(memberSpecMap).forEach((key)=> {
                        if (memberSpecMap[key] === entity) {
                            entity.parent.removeConfig(key);
                        }
                    });
                    break;
            }

            $q.all(relationships.map((relation)=>(blueprintService.refreshRelationships(relation.source)))).then(()=> {
                $scope.$applyAsync(()=> {
                    redrawGraph();
                    $state.go('main.graphical');
                });
            });
        });

        $scope.$on('$stateChangeSuccess', (event, toState, toParams, fromState, fromParams, options)=> {
            let id;
            switch(toState) {
                case graphicalEditEntityState:
                    id = toParams.entityId;
                    break;
                case graphicalEditSpecState:
                    id = toParams.specId;
                    break;
                case graphicalEditPolicyState:
                    id = toParams.policyId;
                    break;
                case graphicalEditEnricherState:
                    id = toParams.enricherId;
                    break;
            }
            if (angular.isDefined(id)) {
                $log.debug(TAG + 'Select canvas, selected node: ' + id);
                $scope.selectedEntity = blueprintService.findAny(id);
                if ($scope.onSelectionChange) $scope.onSelectionChange($scope.selectedEntity);
            }
        });

        $element.bind('click-svg', (event)=> {
            $log.debug(TAG + 'Select canvas, un-select node (if one selected before)');
            $scope.selectedEntity = null;
            if ($scope.onSelectionChange) $scope.onSelectionChange($scope.selectedEntity);
            $scope.$apply(()=> {
                redrawGraph();
                $state.go('main.graphical');
            });
        });

        $element.bind('click-entity', (event)=> {
            $scope.$apply(()=>{
                $log.debug(TAG + 'edit node ' + event.detail.entity._id, event.detail.entity);
                switch (event.detail.entity.family) {
                    case EntityFamily.ENTITY:
                        $state.go(graphicalEditEntityState, {entityId: event.detail.entity._id});
                        break;
                    case EntityFamily.SPEC:
                        $state.go(graphicalEditSpecState, {entityId: event.detail.entity.parent._id, specId: event.detail.entity._id});
                        break;
                    case EntityFamily.POLICY:
                        $state.go(graphicalEditPolicyState, {entityId: event.detail.entity.parent._id, policyId: event.detail.entity._id});
                        break;
                    case EntityFamily.ENRICHER:
                        $state.go(graphicalEditEnricherState, {entityId: event.detail.entity.parent._id, enricherId: event.detail.entity._id});
                        break;
                }
            });
        });

        $element.bind('click-add-child', (event)=> {
            $log.debug(TAG + 'Add child to node ' + event.detail.entity._id);
            $scope.$apply(()=> {
                $state.go('main.graphical.edit.add', {entityId: event.detail.entity._id, family: 'entity'});
            });
        });

        $element.bind('move-entity', function (event) {
            let currentNode = blueprintService.find(event.detail.nodeId);
            let parentNode = blueprintService.find(event.detail.parentId);
            if (parentNode.hasAncestor(currentNode)) {
                brSnackbar.create('Cannot move an entity node below itself or its own descendants');
            } else {
                $log.debug(TAG + 'move-entity ' + event.detail.nodeId, currentNode);
                let targetIndex = event.detail.targetIndex;
                if (currentNode.parent === parentNode && targetIndex > parentNode.children.indexOf(currentNode)) {
                    targetIndex--;
                }
                currentNode.parent.removeChild(currentNode._id);
                if (targetIndex >= 0) {
                    parentNode.insertChild(currentNode, targetIndex);
                }
                else {
                    parentNode.addChild(currentNode);
                }
            }
            blueprintService.refreshAllRelationships().then(()=> {
                redrawGraph();
            });
        });

        $element.bind('delete-entity', function (event) {
            $log.debug('delete-entity');
            $scope.$broadcast('d3.remove', event.detail.entity);
        });

        $element.bind('drop-external-node', event => {
            let draggedItem = paletteDragAndDropService.draggedItem();
            let target = blueprintService.find(event.detail.parentId);

            if (draggedItem.supertypes.includes(EntityFamily.ENTITY.superType)) {
                let targetIndex = event.detail.targetIndex;
                let newEntity = blueprintService.populateEntityFromApi(new Entity(), draggedItem);
                if (targetIndex >= 0) {
                    target.insertChild(newEntity, targetIndex);
                } else {
                    target.addChild(newEntity);
                }
                blueprintService.refreshEntityMetadata(newEntity, EntityFamily.ENTITY).then(() => {
                    $state.go(graphicalEditEntityState, {entityId: newEntity._id});
                });
            }
            else if (draggedItem.supertypes.includes(EntityFamily.POLICY.superType)) {
                let newPolicy = blueprintService.populateEntityFromApi(new Entity(), draggedItem);
                target.addPolicy(newPolicy);
                blueprintService.refreshEntityMetadata(newPolicy, EntityFamily.POLICY).then(() => {
                    $state.go(graphicalEditPolicyState, {entityId: target._id, policyId: newPolicy._id});
                });
            }
            else if (draggedItem.supertypes.includes(EntityFamily.ENRICHER.superType)) {
                let newEnricher = blueprintService.populateEntityFromApi(new Entity(), draggedItem);
                target.addEnricher(newEnricher);
                blueprintService.refreshEntityMetadata(newEnricher, EntityFamily.ENRICHER).then(() => {
                    $state.go(graphicalEditEnricherState, {entityId: target._id, enricherId: newEnricher._id});
                });
            }
            else if (draggedItem.supertypes.includes(EntityFamily.LOCATION.superType)) {
                blueprintService.populateLocationFromApi(target, draggedItem);
                $state.go(graphicalEditEntityState, {entityId: target._id});
            }
            blueprintService.refreshAllRelationships().then(()=> {
                redrawGraph();
            });
        });

        function redrawGraph() {
            let crossLinks = blueprintService.getRelationships();

            blueprintGraph.update($scope.blueprint, crossLinks).draw();
            if ($scope.selectedEntity) {
                blueprintGraph.select($scope.selectedEntity._id);
            } else {
                blueprintGraph.unselect();
            }
        }
    }
}
