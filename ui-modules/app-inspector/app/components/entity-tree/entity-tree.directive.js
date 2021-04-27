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
             * @param {Array} entityTree The entity tree to process and prepare view modes for.
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
                let children = [];
                if (!Array.isArray(entities) || entities.length === 0) {
                    return children;
                }
                entities.forEach(entity => {
                    children = children.concat(entityTreeToArray(entity.children));
                    children = children.concat(entityTreeToArray(entity.members));
                })

                return entities.concat(children);
            }

            /**
             * Extends entity tree with 'host_for/hosted_on' view mode. Moves entities (creates copies) if their host is
             * not a parent and labels them to display under 'host_for/hosted_on' view mode only.
             *
             * @param {Array.<Object>} entities The entity tree converted to array.
             * @param {Array.<Object>} relationships The relationships of entities.
             */
            function addHostForHostedOnView(entities, relationships) {
                entities.forEach(entity => {
                    let relationship = relationships.find(r => r.id === entity.id);
                    if (relationship && relationship.name === RELATIONSHIP_HOST_FOR) {
                        displayEntityInView(entity, VIEW_HOST_FOR_HOSTED_ON);
                        highlightEntityInView(entity, VIEW_HOST_FOR_HOSTED_ON);

                        relationship.targets.forEach(target => {
                            let child = entities.find(e => e.id === target);
                            if (child) {
                                highlightEntityInView(child, VIEW_HOST_FOR_HOSTED_ON);
                                if (child.parentId !== entity.id) { // Move (copy) child under 'hosted_on' entity.
                                    let childCopy = Object.assign({}, child); // Copy entity

                                    // Display in 'host_for/hosted_on' view only.
                                    childCopy.viewModes = null;
                                    displayEntityInView(childCopy, VIEW_HOST_FOR_HOSTED_ON);

                                    let parent = findEntity(entities, child.parentId);
                                    if (parent) {
                                        childCopy.name += ' (' + parent.name + ')';
                                    }

                                    if (!entity.children) {
                                        entity.children = [childCopy];
                                    } else {
                                        entity.children.push(childCopy);
                                    }
                                }
                                displayParentsInView(entities, child.parentId, VIEW_HOST_FOR_HOSTED_ON);
                            }
                        });
                    } else if (!relationship || relationship.name !== RELATIONSHIP_HOSTED_ON) {
                        // Display original position for any other entity under 'host_for/hosted_on' view.
                        displayEntityInView(entity, VIEW_HOST_FOR_HOSTED_ON);
                        // Spotlight will never be on entities that are required to be displayed but do not belong to this view.
                    }
                });
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
             * @param {Object} entities The entity tree to initialize with 'parent/child' view mode.
             */
            function initParentChildView(entities) {
                entities.forEach(entity => {
                    displayEntityInView(entity, VIEW_PARENT_CHILD);
                    highlightEntityInView(entity, VIEW_PARENT_CHILD);
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
         * @returns {boolean} True if entity is a secondary in a current view, false otherwise. Secondary entity is one
         * that is not part of relationship view the id currently displayed.
         */
        $scope.isSecondary = function() {
            return !$scope.entity.viewModesHighlight.has($scope.viewMode);
        };

        /**
         * Counts amount of entities that are expected to be displayed in the current view.
         *
         * @param {Array.<Object>} entities The array of entities to count amount for.
         * @returns {number} Amount of entities in the current view.
         */
        $scope.entitiesInCurrentView = (entities) => {
            if (!entities) {
                return 0;
            }
            return entities.filter(entity => entity.viewModes.has($scope.viewMode)).length || 0;
        }
    }
}
