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

import brooklynStatus from 'brooklyn-ui-utils/status/status';
import brWebNotifications from 'brooklyn-ui-utils/web-notifications/web-notifications';

import entityTreeTemplate from './entity-tree.html';
import entityNodeTemplate from './entity-node.html';
import {inspectState} from '../../views/main/inspect/inspect.controller';
import {summaryState} from '../../views/main/inspect/summary/summary.controller';
import {activitiesState} from '../../views/main/inspect/activities/activities.controller';
import {detailState} from '../../views/main/inspect/activities/detail/detail.controller';
import {managementState} from '../../views/main/inspect/management/management.controller';
import {detailState as managementDetailState} from '../../views/main/inspect/management/detail/detail.controller';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import {
    RELATIONSHIP_HOST_FOR,
    RELATIONSHIP_HOSTED_ON,
    VIEW_HOST_FOR_HOSTED_ON,
    VIEW_PARENT_CHILD
} from '../../views/main/main.controller';

const MODULE_NAME = 'inspector.entity.tree';

angular.module(MODULE_NAME, [brooklynStatus, brWebNotifications])
    .directive('entityTree', entityTreeDirective)
    .directive('entityNode', entityNodeDirective);

export default MODULE_NAME;

export function entityTreeDirective() {
    return {
        restrict: 'E',
        template: entityTreeTemplate,
        scope: {
            sortReverse: '=',
            viewModes: '=',
            viewMode: '<'
        },
        controller: ['$scope', '$state', 'applicationApi', 'entityApi', 'iconService', 'brWebNotifications', controller],
        controllerAs: 'vm'
    };

    function controller($scope, $state, applicationApi, entityApi, iconService, brWebNotifications) {
        $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

        let vm = this;

        let observers = [];

        applicationApi.applicationsTree().then((response)=> {
            vm.applications = response.data;
            analyzeRelationships(vm.applications);

            observers.push(response.subscribe((response)=> {
                response.data
                    .filter(x => vm.applications.map(y => y.id).indexOf(x.id) === -1)
                    .forEach((app) => {
                        spawnNotification(app, {
                            body: 'New application deployment. Current status: ' + app.serviceState,
                            data: $state.href('main.inspect.summary', {applicationId: app.id, entityId: app.id})
                        });
                    });
                vm.applications
                    .filter(x => response.data.map(y => y.id).indexOf(x.id) === -1)
                    .forEach((app) => {
                        spawnNotification(app, {
                            body: 'Application permanently un-deployed',
                            data: $state.href('main')
                        });
                    });

                vm.applications = response.data;
                analyzeRelationships(vm.applications);

                function spawnNotification(app, opts) {
                    iconService.get(app).then((icon)=> {
                        let options = Object.assign({
                            icon: app.iconUrl || icon,
                        }, opts);

                        brWebNotifications.send('Brooklyn: ' + app.name, options);
                    });
                }
            }));

            /**
             * Analyzes relationships of the entity tree and prepares mode views, e.g. 'parent/child' and 'host_for/hosted_on'.
             *
             * @param {Array.<Object>} entityTree The entity tree to process and prepare view modes for.
             */
            function analyzeRelationships(entityTree) {
                let entities = entityTreeToArray(entityTree);
                let relationships = findAllRelationships(entities);

                // Initialize entity tree with 'parent/child' view first (default view).
                initParentChildView(entities);

                // Identify new view modes based on relationships. This adds a drop-down menu with new views if found any.
                updateViewModes(relationships);

                // Re-arrange entity tree for 'host_for/hosted_on' view if present.
                if ($scope.viewModes.has(VIEW_HOST_FOR_HOSTED_ON)) {
                    addHostForHostedOnView(entities, relationships);
                }
            }

            /**
             * Converts entity tree to array of entities.
             *
             * @param {Array.<Object>} entities The entity tree to convert.
             * @returns {Array.<Object>} The array of all entities found in the tree.
             */
            function entityTreeToArray(entities) {
                let nodes = [];
                if (!Array.isArray(entities) || entities.length === 0) {
                    return nodes;
                }
                entities.forEach(entity => {
                    nodes = nodes.concat(entityTreeToArray(entity.children));
                    nodes = nodes.concat(entityTreeToArray(entity.members));
                });
                return entities.concat(nodes);
            }

            /**
             * Extends entity tree with 'host_for/hosted_on' view mode. Moves entities (creates copies) if their host is
             * not a parent and labels them to display under 'host_for/hosted_on' view mode only.
             *
             * @param {Array.<Object>} entities The entity tree converted to array.
             * @param {Array.<Object>} relationships The relationships of entities.
             */
            function addHostForHostedOnView(entities, relationships) {

                // Look through all entities found in the entity tree
                entities.forEach(entity => {

                    // Check if entity has 'host_for/hosted_on' relationship.
                    let relationship = relationships.find(r => r.id === entity.id);
                    if (relationship && relationship.name === RELATIONSHIP_HOST_FOR) {

                        // Label every 'host_for' entity to display and highlight in 'host_for/hosted_on' view mode.
                        displayEntityInView(entity, VIEW_HOST_FOR_HOSTED_ON);
                        highlightEntityInView(entity, VIEW_HOST_FOR_HOSTED_ON);

                        // Look for 'hosted_on' entities under 'host_for', flip of move them and label to display in
                        // 'host_for/hosted_on' view mode respectively.
                        relationship.targets.forEach(target => {
                            let relatedEntity = entities.find(e => e.id === target);
                            if (relatedEntity) {
                                highlightEntityInView(relatedEntity, VIEW_HOST_FOR_HOSTED_ON);
                                displayParentsInView(entities, relatedEntity.parentId, VIEW_HOST_FOR_HOSTED_ON);

                                // Re-arrange the tree if related 'hosted_on' entity is not a child of 'host_for'.
                                if (relatedEntity.parentId !== entity.id) {

                                    if (relatedEntity.id === entity.parentId) {
                                        // 4.1. Flip 'hosted_on' parent with a 'host_for' child.
                                        flipParentAndChild(relatedEntity, entity, entities, VIEW_HOST_FOR_HOSTED_ON);
                                    } else {
                                        // 4.2. Move 'hosted_on' entity to a new 'host_for' parent.
                                        moveEntityToParent(relatedEntity, entity, entities, VIEW_HOST_FOR_HOSTED_ON);
                                    }
                                }
                            }
                        });
                    } else if (!relationship || relationship.name !== RELATIONSHIP_HOSTED_ON) {

                        // Display original position for any other entity under 'host_for/hosted_on' view. Do no highlight
                        // entities that are required to be displayed but do not belong to this view.
                        displayEntityInView(entity, VIEW_HOST_FOR_HOSTED_ON);
                    }
                });
            }

            /**
             * Flips parent entity with its child.
             *
             * @param {Object} parent The parent entity to flip with its child.
             * @param {Object} child The child entity to flip with its parent.
             * @param {Array.<Object>} entities The entity tree converted to array.
             * @param {string} viewMode The view mode to display copy of the entity in only.
             */
            function flipParentAndChild(parent, child, entities, viewMode) {
                let parentOfTheParent = findEntity(entities, parent.parentId);
                if (parentOfTheParent) {
                    hideEntityInView(child, viewMode);
                    let childCopy = moveEntityToParent(child, parentOfTheParent, entities, viewMode);
                    moveEntityToParent(parent, childCopy, entities, viewMode);
                }
            }

            /**
             * Moves entity to a new parent, creates copy of the entity under parent.otherNodes.
             *
             * @param {Object} entity The entity to move.
             * @param {Object} parent The parent to move entity to.
             * @param {Array.<Object>} entities The entity tree converted to array.
             * @param {string} viewMode The view mode to display copy of the entity in only.
             * @returns {Object} The copy of the entity under parent.otherNodes.
             */
            function moveEntityToParent(entity, parent, entities, viewMode) {
                // 1. Create a copy.
                let entityCopy = Object.assign({}, entity);

                // 2. Include the name of the original parent.
                let parentOfEntity = findEntity(entities, entityCopy.parentId);
                if (parentOfEntity) {
                    entityCopy.name += ' (' + parentOfEntity.name + ')';
                }

                // 3. Label it to display in a view mode specified only.
                entityCopy.viewModes = null;
                displayEntityInView(entityCopy, viewMode);

                // 4. Add copy under otherNodes.
                if (!parent.otherNodes) {
                    parent.otherNodes = [entityCopy];
                } else {
                    parent.otherNodes.push(entityCopy);
                }

                return entityCopy;
            }

            /**
             * Labels all parents to display for a particular view mode starting from a specified ID, traverses the node
             * tree recursively, bottom-up.
             *
             * @param {Array.<Object>} entities The array of entities to search parents to label.
             * @param {string} id The ID of a parent entity to start labelling.
             * @param {string} viewMode The view mode to display parent in.
             */
            function displayParentsInView(entities, id, viewMode) {
                let entity = findEntity(entities, id);
                if (entity) {
                    displayEntityInView(entity, viewMode);
                    displayParentsInView(entities, entity.parentId, viewMode);
                }
            }

            /**
             * Attempts to find entity with ID specified in array of entities.
             *
             * @param {Array.<Object>} entities The array of entities to search for a particular entity in.
             * @param {string} id The ID of entity to look for.
             * @returns {Object} The entity with ID requested, and undefined otherwise.
             */
            function findEntity(entities, id) {
                return entities.find(entity => entity.id === id) || null;
            }

            /**
             * Labels entity to not display in particular view mode.
             *
             * @param {Object} entity The entity to label.
             * @param {string} viewMode The view mode to not display entity in.
             */
            function hideEntityInView(entity, viewMode) {
                if (entity.viewModes) {
                    entity.viewModes.delete(viewMode);
                }
            }

            /**
             * Labels entity to display in particular view mode.
             *
             * @param {Object} entity The entity to label.
             * @param {string} viewMode The view mode to display entity in.
             */
            function displayEntityInView(entity, viewMode) {
                if (!entity.viewModes) {
                    entity.viewModes = new Set([viewMode]);
                } else {
                    entity.viewModes.add(viewMode);
                }
            }

            /**
             * Labels entity to highlight in particular view mode.
             *
             * @param {Object} entity The entity to label.
             * @param {string} viewMode The view mode to highlight entity in.
             */
            function highlightEntityInView(entity, viewMode) {
                if (!entity.viewModesHighlight) {
                    entity.viewModesHighlight = new Set([viewMode]);
                } else {
                    entity.viewModesHighlight.add(viewMode);
                }
            }

            /**
             * Initializes entity tree with 'parent/child' view mode. This is a default view mode.
             *
             * @param {Array.<Object>} entities The entity tree to initialize with 'parent/child' view mode.
             */
            function initParentChildView(entities) {
                entities.forEach(entity => {
                    displayEntityInView(entity, VIEW_PARENT_CHILD);
                });
            }

            /**
             * Identifies new view modes based on relationships between entities. Updates {@link $scope.viewModes} set.
             *
             * @param {Array.<Object>} relationships The relationships of entities.
             */
            function updateViewModes(relationships) {
                let viewModesDiscovered = new Set([VIEW_PARENT_CHILD]); // 'parent/child' view mode is a minimum required

                relationships.forEach(relationship => {
                    relationship.targets.forEach(id => {
                        let target = relationships.find(item => item.id === id);
                        if (target) {
                            let uniqueRelationshipName = [relationship.name, target.name].sort().join('/'); // e.g. host_for/hosted_on
                            viewModesDiscovered.add(uniqueRelationshipName);
                        }
                    })
                });

                $scope.viewModes = viewModesDiscovered; // Refresh view modes
            }

            /**
             * Finds relationships in array of entities.
             *
             * @param {Array.<Object>} entities The array of entities to search relationships in.
             * @returns {Array.<Object>} Relationships found in entities.
             */
            function findAllRelationships(entities) {
                let relationships = [];

                if (!Array.isArray(entities) || entities.length === 0) {
                    return relationships;
                }

                entities.forEach(entity => {
                    if (Array.isArray(entity.relations)) {
                        entity.relations.forEach(r => {
                            let relationship = {
                                id: entity.id,
                                name: r.type.name.split('/')[0], // read name up until '/', e.g. take 'hosted_on' from 'hosted_on/oU7i'
                                targets: Array.isArray(r.targets) ? r.targets : []
                            }
                            relationships.push(relationship)
                        });
                    }
                });

                return relationships;
            }
        });

        $scope.$on('$destroy', ()=> {
            observers.forEach((observer)=> {
                observer.unsubscribe();
            });
        });
    }
}

export function entityNodeDirective() {
    return {
        restrict: 'E',
        template: entityNodeTemplate,
        scope: {
            entity: '<',
            applicationId: '<',
            viewMode: '<'
        },
        link: link,
        controller: ['$scope', '$state', '$stateParams', 'iconService', controller]
    };

    function link($scope) {
        $scope.$on('notifyEntity', function (ev, data) {
            if ($scope.entity.id) {
                if (data.id !== $scope.entity.id) {
                    switch (data.message) {
                        case 'expandChildren':
                            $scope.isOpen = data.open;
                            $scope.isChildrenOpen = data.open;
                            break;
                        case 'openChildren' :
                            $scope.isOpen = data.open;
                    }
                }
            }
        });
    }

    function controller ($scope, $state, $stateParams, iconService) {
        $scope.isOpen = true;
        iconService.get($scope.entity, true).then(value => $scope.iconUrl = value);
        
        if ($stateParams.entityId === $scope.entity.id) {
            $scope.$emit('notifyEntity', {
                message: 'expandChildren',
                id: $scope.entity.id,
                open: true
            });
        }

        $scope.isSelected = function() {
            return $stateParams.entityId === $scope.entity.id;
        };

        $scope.getHref = function() {
            if ($state.current.name.startsWith(detailState.name)) {
                return $state.href(activitiesState.name, {
                    applicationId: $scope.applicationId,
                    entityId: $scope.entity.id
                });
            }
            if ($state.current.name.startsWith(managementDetailState.name)) {
                return $state.href(managementState.name, {
                    applicationId: $scope.applicationId,
                    entityId: $scope.entity.id
                });
            }
            if ($state.current.name.startsWith(inspectState.name)) {
                return $state.href($state.current.name, {
                    applicationId: $scope.applicationId,
                    entityId: $scope.entity.id
                });
            }
            return $state.href(summaryState.name, {
                applicationId: $scope.applicationId,
                entityId: $scope.entity.id
            });
        };

        $scope.onToggle = function ($event) {
            if ($event.shiftKey && $event.metaKey) {
                $scope.isChildrenOpen = !$scope.isChildrenOpen;
                $scope.$broadcast('notifyEntity', {
                    'message': 'expandChildren',
                    'id': $scope.entity.id,
                    'open': $scope.isChildrenOpen
                });
            } else {
                $scope.isOpen = true;
                $scope.isChildrenOpen = !$scope.isChildrenOpen;
                $scope.$broadcast('notifyEntity', {
                    'message': 'openChildren',
                    'id': $scope.entityId,
                    'open': $scope.isOpen
                });
            }
        };

        /**
         * @returns {boolean} True if to highlight entity in a current view, false otherwise.
         */
        $scope.isHighlight = function() {
            return $scope.entity.viewModesHighlight && $scope.entity.viewModesHighlight.has($scope.viewMode);
        };

        /**
         * Counts amount of entity nodes that are expected to be displayed in the current view.
         *
         * @returns {number} Amount of entity nodes in the current view.
         */
        $scope.nodesInCurrentView = () => {
            let amount = 0;
            if ($scope.entity.children) {
                amount += $scope.entity.children.filter(entity => entity.viewModes.has($scope.viewMode)).length;
            }
            if ($scope.entity.members) {
                amount += $scope.entity.members.filter(entity => entity.viewModes.has($scope.viewMode)).length;
            }
            if ($scope.entity.otherNodes) {
                amount += $scope.entity.otherNodes.filter(entity => entity.viewModes.has($scope.viewMode)).length;
            }
            return amount;
        }
    }
}
