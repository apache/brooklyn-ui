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
import angular from "angular";
import {fromNow, duration} from "brooklyn-ui-utils/utils/momentp";
import moment from "moment";
import template from "./task-list.template.html";
import {getTaskWorkflowTag} from "../../views/main/inspect/activities/detail/detail.controller";

const MODULE_NAME = 'inspector.task-list';

angular.module(MODULE_NAME, [])
    .directive('taskList', taskListDirective)
    .filter('timeAgoFilter', timeAgoFilter)
    .filter('dateFilter', dateFilter)
    .filter('durationFilter', durationFilter)
    .filter('activityFilter', ['$filter', activityFilter]);

export default MODULE_NAME;

export function taskListDirective() {
    return {
        template: template,
        restrict: 'E',
        scope: {
            tasks: '=',
            taskType: '@',
            filteredCallback: '&?',
            search: '<',
        },
        controller: ['$scope', '$element', controller]
    };

    function controller($scope, $element) {
        const isActivityChildren = $scope.taskType === 'activityChildren';

        $scope.globalFilters = {
            // transient set when those tags seen
        };

        $scope.isEmpty = x => _.isNil(x) || x.length==0 || (typeof x === "object" && Object.keys(x).length==0);
        $scope.filters = { available: {}, selectedFilters: {}, selectedIds: {} };
        $scope.model = {
            appendTo: $element,
            filterResult: null,
        };
        $scope.tasksFilteredByTag = [];

        $scope.findTasksExcludingCategory = (tasks, selected, categoryToExclude) => {
            let result = tasks || [];

            if (selected) {
                _.uniq(Object.values(selected).map(f => f.category)).forEach(category => {
                    if (categoryToExclude === '' || categoryToExclude != category) {
                        let newResult = [];
                        if ($scope.filters.startingSetFilterForCategory[category]) {
                            newResult = $scope.filters.startingSetFilterForCategory[category](result);
                        }
                        Object.values(selected).filter(f => f.category === category).forEach(f => {
                            const filter = f.filter;
                            if (!filter) {
                                console.warn("Incomplete activities tag filter", tagF);
                            } else {
                                newResult = newResult.concat(filter(result));
                            }
                        });

                        // limit result, but preserving order
                        newResult = newResult.map(t => t.id);
                        result = result.filter(t => newResult.includes(t.id));
                    }
                })
            }
            return result;
        };
        $scope.recomputeTasks = () => {
            $scope.tasksFilteredByTag = $scope.findTasksExcludingCategory(
                tasksAfterGlobalFilters($scope.tasks, $scope.globalFilters),
                $scope.filters.selectedFilters, '');

            // do this to update the counts
            setFiltersForTasks($scope, isActivityChildren);

            // now update name
            const enabledCategories = _.uniq(Object.values($scope.filters.selectedFilters).map(f => f.category));
            let filterNameParts = Object.entries($scope.filters.displayNameForCategory).map(([category, nameFn]) => {
                if (!enabledCategories.includes(category)) return null;
                let nf = $scope.filters.displayNameForCategory[category];
                return nf ? nf(Object.values($scope.filters.selectedFilters).filter(f => f.category === category)) : null;
            }).filter(x => x);
            $scope.filters.selectedDisplayName = filterNameParts.length ? filterNameParts.join('; ') :
                isActivityChildren ? 'all sub-tasks' : 'all tasks';
        };

        function selectFilter(filterId, state) {
            // annoying, but since task list is live updated, we store the last value of selectedIds in the event filters come and go;
            // mainly tried because initial order could be too strange, but now we correct that, so this isn't so important
            let oldTheoreticalEnablement = $scope.filters.selectedIds[filterId];

            const f = $scope.filters.available[filterId];
            if (!f) {
                console.log("FILTER "+filterId+" not available yet, storing theoretical enablement");

                if (!_.isNil(state) ? state : !oldTheoreticalEnablement) {
                    $scope.filters.selectedIds[filterId] = 'theoretically-enabled';
                } else {
                    delete $scope.filters.selectedIds[filterId];
                }

                // we tried to select eg effector, when it didn't exist
                return false;
            } else {
                f.select(filterId, f, state);
                return true;
            }
        }

        setFiltersForTasks($scope, isActivityChildren);
        $scope.filterValue = $scope.search;

        selectFilter("_top", true);
        selectFilter("_anyTypeTag", true);
        if ($scope.taskType === 'activity') {
            // default?
            selectFilter('EFFECTOR');
            selectFilter('WORKFLOW');
        } else if ($scope.taskType) {
            selectFilter($scope.taskType);
        } else {
            // TODO when is this called?
            selectFilter('EFFECTOR');
            selectFilter('WORKFLOW');
        }

        cacheSelectedIdsFromFilters($scope);
        selectFilter("_workflowReplayed");
        selectFilter("_workflowNonLastReplayHidden");

        console.log($scope.filters);

        // // this would be nice, but it doesn't play nice with dynamic task updates
        // // sometimes no tasks are loaded yet and this enables the "all" but then tasks get loaded
        // if ($scope.tasksFilteredByTag.length==0) {
        //     // if nothing found at top level then broaden
        //     selectFilter("_top", false);
        // }



        // TODO check taskType=activity...  .... can they not all just leave it off, to send the default; send the default?
        // and make sure others send EFFECTOR

        // if ((!$scope.taskType || $scope.taskType.startsWith('activity')) && (!filterPreselected || $scope.tasksFilteredByTag.length==0 )) {
        //     // if nothing found with filters, try disabling the filters
        //     filterPreselected = selectFilter('_top', false);
        //     if (!filterPreselected || $scope.tasksFilteredByTag.length == 0 ) {
        //         selectFilter('_top', true);
        //     }
        // }

        $scope.isScheduled = isScheduled;

        $scope.$watch('tasks', ()=>{
            $scope.recomputeTasks();
        });
        $scope.$watch('globalFilters', ()=>{
            $scope.recomputeTasks();
        });

        $scope.getTaskDuration = function(task) {
            if (!task.startTimeUtc) {
                return null;
            }
            if (!_.isNil(task.endTimeUtc) && task.endTimeUtc <= 0) return null;
            return (task.endTimeUtc === null ? new Date().getTime() : task.endTimeUtc) - task.startTimeUtc;
        }

        $scope.$watch('model.filterResult', function () {
            if ($scope.filteredCallback && $scope.model.filterResult) $scope.filteredCallback()( $scope.model.filterResult, $scope.globalFilters );
        });
        $scope.getTaskWorkflowId = task => {
            const tag = getTaskWorkflowTag(task);
            if (tag) return tag.workflowId;
            return null;
        };

        $scope.recomputeTasks();
    }

    function setFiltersForTasks(scope, isActivityChildren) {
        const tasksAll = scope.tasks || [];
        const globalFilters = scope.globalFilters;

        // include a toggle for transient tasks
        if (!globalFilters.transient) {
            const numTransient = filterForTasksWithTag('TRANSIENT')(tasksAll).length;
            if (numTransient>0 && numTransient<tasksAll.length) {
                // only default to filtering transient if some but not all are transient
                globalFilters.transient = {
                    include: true,
                    action: ()=>{
                        globalFilters.transient.include = !globalFilters.transient.include;
                        globalFilters.transient.display = (globalFilters.transient.include ? 'Hide' : 'Show') + ' transient tasks';
                        setFiltersForTasks(scope, isActivityChildren);
                    },
                };
                globalFilters.transient.action();
            }
        }

        const tasks = tasksAfterGlobalFilters(tasksAll, globalFilters);

        function defaultToggleFilter(tag, value, forceValue, fromUi, skipRecompute) {
            if ((scope.filters.selectedIds[tag] && _.isNil(forceValue)) || forceValue===false) {
                delete scope.filters.selectedIds[tag];
                delete scope.filters.selectedFilters[tag];
                if (value.onDisabledPost) value.onDisabledPost(tag, value, forceValue);
            } else {
                if (value.onEnabledPre) value.onEnabledPre(tag, value, forceValue);
                scope.filters.selectedIds[tag] = 'enabled';
                scope.filters.selectedFilters[tag] = value;
            }
            if (fromUi) {
                // on a UI click, don't try to be too clever about remembered IDs
                cacheSelectedIdsFromFilters(scope);
            }

            if (!skipRecompute) scope.recomputeTasks();
        }

        /*
          MENU should look like following, with group-specific behaviour for filtering and enablement,
          e.g. auto-enable all of first group if only is de-selected:

          Only show top-level tasks
        x Show tasks called from other entities
                submittedByTask==null ||
                submittedByTask.metadata.entityId != entityId
          Show tasks nested within this entity
          ---
          Any task type/tag
        x Effector calls
        x Workflows
          Tag: tag1
          Tag: tag2


TODO workflow ui
          ? most recent run of workflow only
             combine others under last if loaded
          ? show individual workflows resumed on startup! ? label as top-level?
         */

        function clearCategory(category) {
            return function(filterId, filter, forceValue) {
                Object.entries(scope.filters.selectedFilters).forEach( ([k,v])=> {
                    if (v.category === (category || filter.category)) {
                        delete scope.filters.selectedFilters[k];
                    }
                });
            }
        }
        function clearOther(idToClear) {
            return function(filterId, filter, forceValue) {
                delete scope.filters.selectedFilters[idToClear];
            }
        }
        function enableFilterIfCategoryEmpty(idToEnable, category) {
            return function(filterId, filter, forceValue) {
                if (!Object.values(scope.filters.selectedFilters).find(f => f.category === (category||filter.category))) {
                    // empty
                    const other = scope.filters.available[idToEnable || filterId];
                    if (other) scope.filters.selectedFilters[idToEnable || filterId] = other;
                }
            }
        }
        function enableOthersIfCategoryEmpty(idToLeaveDisabled, category) {
            return function(filterId, filter, forceValue) {
                if (!Object.values(scope.filters.selectedFilters).find(f => f.category === (category||filter.category))) {
                    // empty
                    Object.entries(scope.filters.available).forEach( ([k,f]) => {
                        if (f.category === (category||filter.category) && k !== (idToLeaveDisabled || filterId)) {
                            scope.filters.selectedFilters[k] = f;
                        }
                    });
                }
            }
        }

        const defaultFilters = {};

        let tasksById = tasksAll.reduce( (result,t) => { result[t.id] = t; return result; }, {} );
        function filterTopLevelTasks(tasks) { return filterWithId(tasks, tasksById, isTopLevelTask); }
        function filterNonTopLevelTasks(tasks) { return filterWithId(tasks, tasksById, isNonTopLevelTask); }
        function filterCrossEntityTasks(tasks) { return filterWithId(tasks, tasksById, isCrossEntityTask); }
        function filterNestedSameEntityTasks(tasks) { return filterWithId(tasks, tasksById, isNestedSameEntityTask); }

        scope.filters.startingSetFilterForCategory = {
            nested: filterTopLevelTasks,
        };
        function getFilterOrEmpty(id) {
            return id && (id.filter ? id : scope.filters.available[id]) || {};
        }
        scope.filters.displayNameForCategory = {
            nested: set => {
                if (!set || !set.length) return null;
                let nestedFiltersAvailable = Object.values(scope.filters.available).filter(f => f.category === 'nested');
                if (set.length == nestedFiltersAvailable.length-1 && !set[0].isDefault) {
                    // everything but first is selected, so no message
                    return null;
                }
                if (set.length==1) {
                    return getFilterOrEmpty(set[0]).displaySummary;
                }
                // all tasks
                return null;
            },
            'type/tag': set => {
                if (!set || !set.length) return null;
                if (set.length<=3) {
                    let tags = set.map(s => (getFilterOrEmpty(s).displaySummary || '').toLowerCase()).filter(x => x);
                    if (tags.length==0) return null;
                    if (tags.length==1) return tags[0];
                    if (tags.length==2) return tags[0] + ' or ' + tags[1];
                    if (tags.length==3) return tags[0] + ', ' + tags[1] + ', or ' + tags[2];
                }
                return 'any of multiple tags'
            },
        };
        defaultFilters['_top'] = {
            display: 'Only show ' + (isActivityChildren ? 'direct sub-tasks' : 'top-level tasks'),
            displaySummary: 'only top-level tasks',
            isDefault: true,
            filter: filterTopLevelTasks,  // redundant with starting set, but contributes the right count
            category: 'nested',
            onEnabledPre: clearCategory(),
            onDisabledPost: enableOthersIfCategoryEmpty('_top'),
        }
        if (!isActivityChildren) {
            defaultFilters['_cross_entity'] = {
                display: 'Include cross-entity sub-tasks',
                displaySummary: 'cross-entity tasks',
                filter: filterCrossEntityTasks,
                category: 'nested',
                onEnabledPre: clearOther('_top'),
                onDisabledPost: enableFilterIfCategoryEmpty('_top'),
            }
            defaultFilters['_recursive'] = {
                display: 'Include sub-tasks on this entity',
                displaySummary: 'sub-tasks',
                filter: filterNestedSameEntityTasks,
                category: 'nested',
                onEnabledPre: clearOther('_top'),
                onDisabledPost: enableFilterIfCategoryEmpty('_top'),
            }
        } else {
            defaultFilters['_recursive'] = {
                display: 'Show all sub-tasks',
                displaySummary: 'sub-tasks',
                filter: filterNonTopLevelTasks,
                category: 'nested',
                onEnabledPre: clearOther('_top'),
                onDisabledPost: enableFilterIfCategoryEmpty('_top'),
            }
        }

        const countWorkflowsWhichAreNestedButHaveReplayed = tasksAll.filter(t =>
            t.isReplayedWorkflowLatest && t.submittedByTask
        ).length;
        defaultFilters['_workflowReplayed'] = {
            display: 'Include workflow sub-tasks which are replayed',
            displaySummary: null,
            filter: tasks => tasks.filter(t => t.isReplayedWorkflowLatest && t.submittedByTask),
            category: 'nested',
            count: countWorkflowsWhichAreNestedButHaveReplayed,
            countAbsolute: countWorkflowsWhichAreNestedButHaveReplayed,
            onEnabledPre: clearCategory(),
            onDisabledPost: enableOthersIfCategoryEmpty('_anyTypeTag'),
        }

        const countWorkflowsWhichArePreviousReplays = tasksAll.filter(t => t.isWorkflowPreviousRun).length;
        defaultFilters['_workflowNonLastReplayHidden'] = {
            display: 'Exclude old runs of workflows',
            help: 'Some workflows have been replayed, either manually or on a server restart or failover. ' +
                'To simplify the display, old runs of workflow invocations which have been replayed are excluded here by default. ' +
                'The most recent replay will be included, subject to other filters, and previous replays can be accessed ' +
                'on the workflow page.',
            displaySummary: null,
            filter: tasks => tasks.filter(t => {
                    return _.isNil(t.isWorkflowPreviousRun) || !t.isWorkflowPreviousRun;
                }),
            count: countWorkflowsWhichArePreviousReplays,
            countAbsolute: countWorkflowsWhichArePreviousReplays,
            category: 'workflow',
            onEnabledPre: null,
            onDisabledPost: null,
        }

        const countWorkflowsWithoutTaskWhichAreCompleted = tasksAll.filter(t => t.endTimeUtc>0 && t.isTaskStubFromWorkflowRecord).length;
        defaultFilters['_workflowCompletedWithoutTaskHidden'] = {
            display: 'Exclude old completed workflows',
            help: 'Some older workflows no longer have a task record, '+
                'either because they completed in a previous server prior to a server restart or failover, ' +
                'or because their tasks have been cleared from memory in this server. ' +
                'These can be excluded to focus on more recent tasks.',
            displaySummary: null,
            // filter: tasks => tasks.filter(t => t.isWorkflowPreviousRun !== false),
            filter: tasks => tasks.filter(t => !(t.endTimeUtc>0 && t.isTaskStubFromWorkflowRecord)),
            count: countWorkflowsWithoutTaskWhichAreCompleted,
            countAbsolute: countWorkflowsWithoutTaskWhichAreCompleted,
            category: 'workflow2',
            onEnabledPre: null,
            onDisabledPost: null,
        }

        defaultFilters['_anyTypeTag'] = {
            display: 'Any task type or tag',
            displaySummary: null,
            filter: input => input,
            category: 'type/tag',
            onEnabledPre: clearCategory(),
            onDisabledPost: enableOthersIfCategoryEmpty('_anyTypeTag'),
        }

        function addTagFilter(tag, target, display, displaySummary) {
            if (!target[tag]) target[tag] = {
                display: display,
                displaySummary: displaySummary || tag.toLowerCase(),
                filter: filterForTasksWithTag(tag),
                category: 'type/tag',
                onEnabledPre: clearOther('_anyTypeTag'),
                onDisabledPost: enableFilterIfCategoryEmpty('_anyTypeTag'),
            }
        }
        // put these first
        addTagFilter('EFFECTOR', defaultFilters, 'Effectors', 'effector');
        addTagFilter('WORKFLOW', defaultFilters, 'Workflow');

        const filtersIncludingTags = {...defaultFilters};

        // add filters for other tags
        tasks.forEach(t =>
            (t.tags || []).filter(tag => typeof tag === 'string' && tag.length < 32).forEach(tag =>
                    addTagFilter(tag, filtersIncludingTags, 'Tag: ' + tag.toLowerCase())
            ));

        // fill in fields

        Object.entries(filtersIncludingTags).forEach(([k, f]) => {
            if (!f.select) f.select = defaultToggleFilter;
            if (!f.onClick) f.onClick = (filterId, filter) => defaultToggleFilter(filterId, filter, null, true);

            if (_.isNil(f.count)) f.count = scope.findTasksExcludingCategory(f.filter(tasks), scope.filters.selectedFilters, f.category).length;
            if (_.isNil(f.countAbsolute)) f.countAbsolute = f.filter(tasks).length;
        });

        function updateSelectedFilters(newValues) {
            const deferredCalls = [];
            Object.entries(scope.filters.selectedIds).forEach(([filterId,filterSelectionNote]) => {
                const newValue = newValues[filterId];
                const oldValue = scope.filters.selectedFilters[filterId];
                //console.log("enabling ",filterId,filterSelectionNote,newValue,oldValue);
                scope.filters.selectedFilters[filterId] = newValue;
                scope.filters.selectedIds[filterId] = newValue ? 'updated' : filterSelectionNote;
                if (!newValue) delete scope.filters.selectedFilters[filterId];

                if (newValue && filterSelectionNote==="theoretically-enabled") {
                    deferredCalls.push(()=> {
                        // trigger the handler, update other categories, if a category becomes available late
                        console.log("Delayed enablement of filter ", filterId);
                        // console.log("=");
                        newValue.select(filterId, newValue, true, false, true);
                        // console.log("--");
                        // console.log("CATS 1", Object.keys(scope.filters.selectedIds));
                        // console.log("CATS 2", Object.keys(scope.filters.selectedFilters));
                        // console.log("CATS 3", Object.keys(scope.filters.selectedIds));
                    });
                }
            });
            deferredCalls.forEach(c => c());
        }

        // add counts
        //updateSelectedFilters(filtersIncludingTags);

        // filter and move to new map
        let result = {};
        Object.entries(filtersIncludingTags).forEach(([k, f]) => {
            if (f.countAbsolute > 0) result[k] = f;
        });

        // and delete categories that are redundant
        function deleteCategoryIfAllCountsAreEqual(category) {
            if (_.uniq(Object.values(result).filter(f => f.category === category).map(f => f.countAbsolute)).length==1) {
                Object.entries(result).filter(([k,f]) => f.category === category).forEach(([k,f])=>delete result[k]);
            }
        }
        function deleteFiltersInCategoryThatAreEmpty(category) {
            Object.entries(result).filter(([k,f]) => f.category === category && f.countAbsolute==0).forEach(([k,f])=>delete result[k]);
        }
        function deleteCategoryIfSize1(category) {
            const found = Object.entries(result).filter(([k,f]) => f.category === category);
            if (found.length==1) delete result[found[0][0]];
        }
        deleteFiltersInCategoryThatAreEmpty('nested');
        deleteCategoryIfSize1('nested');
        deleteCategoryIfAllCountsAreEqual('type/tag');  // because all tags are on all tasks

        if (!result['_cross_entity'] && result['_recursive']) {
            // if we don't have cross-entity sub-tasks, tidy this message
            result['_recursive'].display = 'Include sub-tasks';
        }

        // // but if we deleted everything, restore them (better to have pointless categories than no categories)
        // if (!Object.keys(result).length) result = filtersIncludingTags;


        // now add dividers between categories
        let lastCat = null;
        for (let v of Object.values(result)) {
            if (lastCat!=null && lastCat!=v.category) {
                v.classes = (v.classes || '') + ' divider-above';
            }
            lastCat = v.category;
        }

        scope.filters.available = result;
        updateSelectedFilters(result);
        return result;
    }
}


function isScheduled(task) {
  return task && task.currentStatus && task.currentStatus.startsWith("Schedule");
}

function isTopLevelTask(t, tasksById) {
    if (!t.submittedByTask) return true;
    if (t.forceTopLevel) return true;
    if (t.tags && t.tags.includes("TOP-LEVEL")) return true;
    let submitter = tasksById[t.submittedByTask.metadata.id];
    if (!submitter) return true;
    if (isScheduled(submitter) && (!t.endTimeUtc || t.endTimeUtc<=0)) return true;
    return false;
}
function isNonTopLevelTask(t, tasksById) {
    return !isTopLevelTask(t, tasksById);
}
function isCrossEntityTask(t, tasksById) {
    if (isTopLevelTask(t, tasksById)) return false;
    return t.submittedByTask.metadata.entityId !== t.entityId;
}
function isNestedSameEntityTask(t, tasksById) {
    if (isTopLevelTask(t, tasksById)) return false;
    return t.submittedByTask.metadata.entityId === t.entityId;
}
function filterWithId(tasks, tasksById, nextFilter) {
    if (!tasks) return tasks;
    return tasks.filter(t => nextFilter(t, tasksById));
}

export function timeAgoFilter() {
    function timeAgo(input) {
        if (!input || input<=0) return "-";
        return fromNow(input);
    }

    timeAgo.$stateful = true;

    return timeAgo;
}

export function dateFilter() {
    function date(input, args) {
        // if (!input || input<=0) return "-";

        if (args==='short') {
            return moment(input).format('MMM D, yyyy @ HH:mm:ss');
        } else if (args==='iso') {
            return moment(input).format('yyyy-MM-DD HH:mm:ss.SSS');
        } else {
            return moment(input).format('MMM D, yyyy @ HH:mm:ss.SSS');
        }
    }

    return date;
}

export function durationFilter() {
    return function (input) {
        return duration(input);
    }
}

function isTaskWithTag(task, tag) {
    if (!task.tags) {
        console.log("Task without tags: ", task);
        return false;
    }
    return task.tags.indexOf(tag)>=0;
}

function filterForTasksWithTag(tag) {
    return (tasks) => tasks.filter(t => isTaskWithTag(t, tag));
}

function tasksAfterGlobalFilters(inputs, globalFilters) {
    if (inputs) {
        if (globalFilters && globalFilters.transient && !globalFilters.transient.include) {
            inputs = inputs.filter(t => !isTaskWithTag(t, 'TRANSIENT'));
        }
    }
    return inputs;
}

function cacheSelectedIdsFromFilters(scope) { scope.filters.selectedIds = { ...scope.filters.selectedFilters }; }

export function activityFilter($filter) {
    return function (activities, searchText) {
        if (activities && searchText && searchText.length > 0) {
            return $filter('filter')(activities, (value, index, array) => {
                return (value.displayName && value.displayName.indexOf(searchText) > -1) ||
                    (value.description && value.description.indexOf(searchText) > -1);
            });
        } else {
            return activities;
        }
    };
}
