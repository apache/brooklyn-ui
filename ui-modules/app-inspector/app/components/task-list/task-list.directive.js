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
            tasksLoaded: '<?',  // if tasks might complete initial loading late, the caller should pass a watchable expression that resolves to true when initially loaded
            taskType: '@?',
            parentTaskId: '@?',
            filteredCallback: '&?',
            search: '<',
        },
        controller: ['$scope', '$element', controller]
    };

    function controller($scope, $element) {
        const isActivityChildren = !! $scope.parentTaskId;

        // selected filters are shared with other views esp kilt view so they can see what is and isn't included.
        // currently only used for transient.
        $scope.globalFilters = {
            // transient set when those tags seen
        };

        $scope.isEmpty = x => _.isNil(x) || x.length==0 || (typeof x === "object" && Object.keys(x).length==0);
        $scope.model = {
            appendTo: $element,
            filterResult: null,
        };
        $scope.tasksFilteredByTag = [];

        $scope.findTasksExcludingCategory = (tasks, selected, categoryToExclude) => {
            let result = tasks || [];

            if (selected) {
                _.uniq(Object.values(selected).map(f => f.categoryForEvaluation || f.category)).forEach(category => {
                    if (categoryToExclude === '' || categoryToExclude != category) {
                        let newResult = [];
                        if ($scope.filters.startingSetFilterForCategory[category]) {
                            newResult = $scope.filters.startingSetFilterForCategory[category](result);
                        }
                        Object.values(selected).filter(f => (f.categoryForEvaluation || f.category) === category).forEach(f => {
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
            $scope.filters.selectedDisplay = [];
            Object.entries($scope.filters.displayNameFunctionForCategory).forEach(([category, nameFn]) => {
                if (!enabledCategories.includes(category)) return null;
                let nf = $scope.filters.displayNameFunctionForCategory[category];
                let badges = nf ? nf(Object.values($scope.filters.selectedFilters).filter(f => (f.categoryForBadges || f.category) === category)) : null;
                badges = (badges || []).filter(x=>x);
                if (badges.length) $scope.filters.selectedDisplay.push({ class: 'dropdown-category-'+category, badges });
            });
            if (!$scope.filters.selectedDisplay.length) $scope.filters.selectedDisplay.push({ class: 'dropdown-category-default', badges: ['all'] });
        };

        function selectFilter(filterId, state) {
            const f = $scope.filters.available[filterId];
            if (!f) {
                // we tried to select eg effector, when it didn't exist, just ignore
                return false;
            } else {
                f.select(filterId, f, state);
                return true;
            }
        }

        $scope.filterValue = $scope.search;

        $scope.isScheduled = isScheduled;

        $scope.getTaskDuration = function(task) {
            if (!task.startTimeUtc) {
                return null;
            }
            if (!_.isNil(task.endTimeUtc) && task.endTimeUtc <= 0) return null;
            return (task.endTimeUtc === null ? new Date().getTime() : task.endTimeUtc) - task.startTimeUtc;
        }
        $scope.getTaskWorkflowId = task => {
            const tag = getTaskWorkflowTag(task);
            if (tag) return tag.workflowId;
            return null;
        };

        $scope.$watch('model.filterResult', function () {
            if ($scope.filteredCallback && $scope.model.filterResult) $scope.filteredCallback()( $scope.model.filterResult, $scope.globalFilters );
        });

        let tasksLoadedTrueReceived = false;

        function refreshDropdownsUntilTasksAreLoaded() {
            if (tasksLoadedTrueReceived || $scope.uiDropdownInteraction) return;
            tasksLoadedTrueReceived = $scope.tasksLoaded;

            $scope.filters = { available: {}, selectedFilters: {} };
            setFiltersForTasks($scope, isActivityChildren);
            selectFilter("_top", true);
            selectFilter("_anyTypeTag", true);
            if ($scope.taskType) {
                selectFilter($scope.taskType);
            } else {
                if (!isActivityChildren) {
                    // defaults (when not in subtask view; in subtask view it is as above)
                    selectFilter('EFFECTOR');
                    selectFilter('WORKFLOW');
                } else {
                    selectFilter('SUB-TASK');
                }
            }
            selectFilter("_workflowReplayedTopLevel");
            selectFilter("_workflowNonLastReplayHidden");

            // pick other filter combos until we get some conetnt
            if ($scope.tasksFilteredByTag.length==0) {
                selectFilter('INITIALIZATION');
            }
            if ($scope.tasksFilteredByTag.length==0) {
                selectFilter("_anyTypeTag", true);
            }
            if ($scope.tasksFilteredByTag.length==0) {
                selectFilter("_top", false);
            }

            $scope.recomputeTasks();
        }

        $scope.$watch('tasks', ()=>{
            $scope.recomputeTasks();
        });
        $scope.$watch('globalFilters', ()=>{
            $scope.recomputeTasks();
        });

        $scope.$watch('tasksLoaded', v => {
            refreshDropdownsUntilTasksAreLoaded();
        });
        refreshDropdownsUntilTasksAreLoaded();
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
                    checked: false,
                    display: 'Exclude transient tasks',
                    help: 'Routine, low-level, usually uninteresting tasks are tagged as TRANSIENT so they can be easily ignored' +
                        'to simplify display and preserve memory for more interesting tasks. ' +
                        'These are by default excluded from this view. ' +
                        'They can be included by de-selecting this option. ' +
                        'Note that transient tasks may be cleared from memory very quickly when they are completed ' +
                        'and can subsequently give warnings in this UI.',
                    filter: inputs => inputs.filter(t => !isTaskWithTag(t, 'TRANSIENT')),
                    onClick: ()=> {
                        globalFilters.transient.action();
                        // need to recompute as the filters are changed now
                        scope.recomputeTasks();
                    },
                    action: ()=>{
                        globalFilters.transient.include = !globalFilters.transient.include;
                        globalFilters.transient.checked = !globalFilters.transient.include;
                        setFiltersForTasks(scope, isActivityChildren);
                    },
                    category: 'status',
                    categoryForEvaluation: 'status-transient',
                };
                globalFilters.transient.action();
            }
        }

        const tasks = tasksAfterGlobalFilters(tasksAll, globalFilters);

        function defaultToggleFilter(tag, value, forceValue, fromUi, skipRecompute) {
            if ((scope.filters.selectedFilters[tag] && _.isNil(forceValue)) || forceValue===false) {
                delete scope.filters.selectedFilters[tag];
                if (value.onDisabledPost) value.onDisabledPost(tag, value, forceValue);
            } else {
                if (value.onEnabledPre) value.onEnabledPre(tag, value, forceValue);
                scope.filters.selectedFilters[tag] = value;
            }
            if (fromUi) {
                // on a UI click, don't try to be too clever about remembered IDs
                scope.uiDropdownInteraction = true;
            }

            if (!skipRecompute) scope.recomputeTasks();
        }

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

        const filtersFullList = {};

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
        scope.filters.displayNameFunctionForCategory = {
            nested: set => {
                if (!set || !set.length) return null;
                let nestedFiltersAvailable = Object.values(scope.filters.available).filter(f => f.category === 'nested');
                if (set.length == nestedFiltersAvailable.length-1 && !set[0].isDefault) {
                    // everything but first is selected, so no message
                    return [ 'all' ];
                }
                return set.map(s => s.displaySummary || '');
                // if (set.length==1) {
                //     return [ getFilterOrEmpty(set[0]).displaySummary ];
                // }
                // // only happens if we have
                // return null;
            },
            'type-tag': set => {
                if (!set || !set.length) return null;
                if (set.length<=3) {
                    return set.map(s => (getFilterOrEmpty(s).displaySummary || '').toLowerCase()).filter(x => x);
                } else {
                    return ['any of '+set.length+' tags'];
                }
            },
        };
        filtersFullList['_top'] = {
            display: 'Only show ' + (isActivityChildren ? 'direct sub-tasks' : 'top-level tasks'),
            displaySummary: 'only top-level',
            isDefault: true,
            filter: filterTopLevelTasks,  // redundant with starting set, but contributes the right count
            category: 'nested',
            onEnabledPre: clearCategory(),
            onDisabledPost: enableOthersIfCategoryEmpty('_top'),
        }
        if (!isActivityChildren) {
            filtersFullList['_cross_entity'] = {
                display: 'Include cross-entity sub-tasks',
                displaySummary: 'cross-entity',
                filter: filterCrossEntityTasks,
                category: 'nested',
                onEnabledPre: clearOther('_top'),
                onDisabledPost: enableFilterIfCategoryEmpty('_top'),
            }
            filtersFullList['_recursive'] = {
                display: 'Include sub-tasks on this entity',
                displaySummary: 'sub-tasks',
                filter: filterNestedSameEntityTasks,
                category: 'nested',
                onEnabledPre: clearOther('_top'),
                onDisabledPost: enableFilterIfCategoryEmpty('_top'),
            }
        } else {
            filtersFullList['_recursive'] = {
                display: 'Show all sub-tasks',
                displaySummary: 'all sub-tasks',
                filter: filterNonTopLevelTasks,
                category: 'nested',
                onEnabledPre: clearOther('_top'),
                onDisabledPost: enableFilterIfCategoryEmpty('_top'),
            }
        }

        filtersFullList['_anyTypeTag'] = {
            display: 'Any task type or tag',
            displaySummary: null,
            filter: input => input,
            category: 'type-tag',
            onEnabledPre: clearCategory(),
            onDisabledPost: enableOthersIfCategoryEmpty('_anyTypeTag'),
        }

        function addTagFilter(tag, target, display, extra) {
            if (!target[tag]) target[tag] = {
                display: display,
                displaySummary: tag.toLowerCase(),
                filter: filterForTasksWithTag(tag),
                category: 'type-tag',
                onEnabledPre: clearOther('_anyTypeTag'),
                onDisabledPost: enableFilterIfCategoryEmpty('_anyTypeTag'),
                ...(extra || {}),
            }
        }

        // put these first if present, to get this order, then remove if false
        if (!isActivityChildren) {
            addTagFilter('EFFECTOR', filtersFullList, 'Effectors', {displaySummary: 'effector', includeIfZero: true});
            addTagFilter('WORKFLOW', filtersFullList, 'Workflow', { includeIfZero: true });
        } else {
            filtersFullList['EFFECTOR'] = false;
            filtersFullList['WORKFLOW'] = false;
        }
        filtersFullList['SENSOR'] = false;
        filtersFullList['INITIALIZATION'] = false;
        filtersFullList['SUB-TASK'] = false;

        // add filters for other tags
        tasks.forEach(t =>
            (t.tags || []).filter(tag => typeof tag === 'string' && tag.length < 32).forEach(tag =>
                    addTagFilter(tag, filtersFullList, 'Tag: ' + tag.toLowerCase())
            ));

        ['EFFECTOR', 'WORKFLOW', 'SUB-TASK', 'SENSORS', 'INITIALIZATION'].forEach(t => { if (!filtersFullList[t]) delete filtersFullList[t]; });
        (filtersFullList['SUB-TASK'] || {}).display = 'Sub-tasks';
        (filtersFullList['SENSOR'] || {}).display = 'Sensors';
        (filtersFullList['INITIALIZATION'] || {}).display = 'Initialization';

        filtersFullList['_active'] = {
            display: 'Only show active tasks',
            displaySummary: 'active',
            filter: tasks => tasks.filter(t => !t.endTimeUtc || t.endTimeUtc<0),
            category: 'status',
            categoryForEvaluation: 'status-active',
        }
        filtersFullList['_scheduled_sub'] = {
            display: 'Only show scheduled tasks',
            displaySummary: 'scheduled',
            filter: tasks => tasks.filter(t => {
                // show scheduled tasks (the parent) and each scheduled run, if sub-tasks are selected
                if (!t || !t.submittedByTask) return false;
                if (isScheduled(t)) return true;
                let submitter = tasksById[t.submittedByTask.metadata.id];
                return isScheduled(submitter);
            }),
            category: 'status',
            categoryForEvaluation: 'status-scheduled',
        }

        const filterWorkflowsReplayedTopLevel = t => !t.isWorkflowFirstRun && t.isWorkflowLastRun && t.isWorkflowTopLevel;
        const countWorkflowsReplayedTopLevel = tasksAll.filter(filterWorkflowsReplayedTopLevel).length;
        filtersFullList['_workflowReplayedTopLevel'] = {
            display: 'Include replayed top-level workflows',
            help: 'Some workflows have been replayed, either manually or on a server restart or failover. ' +
                'Top-level workflows which have been replayed can be listed explicitly to make ' +
                'them easier to find, because they usually have had issues which may require attention.',
            displaySummary: null,
            filter: tasks => tasks.filter(filterWorkflowsReplayedTopLevel),
            categoryForEvaluation: 'nested',
            category: 'workflow',
            count: countWorkflowsReplayedTopLevel,
            countAbsolute: countWorkflowsReplayedTopLevel,
        }

        const countWorkflowsReplayedNested = tasksAll.filter(filterWorkflowsReplayedNested).length;
        filtersFullList['_workflowReplayedNested'] = {
            display: 'Include replayed sub-workflows',
            help: 'Some nested workflows have been replayed, either manually or on a server restart or failover. ' +
                'Nested workflows are those invoked by other workflows, and their replay is usually due to a replay of their parent workflow. '+
                'To simplify the display, these are excluded in this list by default. ' +
                'Their root workflow or task will be shown, subject to other filters, and can be navigated on the workflow page. ' +
                'If this option is enabled, these tasks will included here.',
            displaySummary: null,
            filter: tasks => tasks.filter(filterWorkflowsReplayedNested),
            categoryForEvaluation: 'nested',
            category: 'workflow',
            count: countWorkflowsReplayedNested,
            countAbsolute: countWorkflowsReplayedNested,
        }

        const filterWorkflowsWhichAreNotPreviousReplays = t => _.isNil(t.isWorkflowLastRun) || t.isWorkflowLastRun;
        const filterWorkflowsWhichAreActuallyPreviousReplays = t => !_.isNil(t.isWorkflowLastRun) && !t.isWorkflowLastRun;
        const countWorkflowsWhichArePreviousReplays = tasksAll.filter(filterWorkflowsWhichAreActuallyPreviousReplays).length;
        filtersFullList['_workflowNonLastReplayHidden'] = {
            display: 'Exclude old runs of workflows',
            help: 'Some workflows have been replayed, either manually or on a server restart or failover. ' +
                'To simplify the display, old runs of workflow invocations which have been replayed are excluded in this list by default. ' +
                'The most recent replay will be included, subject to other filters, and previous replays can be accessed on the workflow page. ' +
                'If this option is enabled, these tasks will not be excluded here.',
            displaySummary: null,
            filter: tasks => tasks.filter(filterWorkflowsWhichAreNotPreviousReplays),
            count: countWorkflowsWhichArePreviousReplays,
            countAbsolute: countWorkflowsWhichArePreviousReplays,
            categoryForEvaluation: 'workflow1',
            category: 'workflow',
        }

        const filterWorkflowsWithoutTaskWhichAreCompleted = t => t.endTimeUtc>0 && t.isTaskStubFromWorkflowRecord;
        const countWorkflowsWithoutTaskWhichAreCompleted = tasksAll.filter(filterWorkflowsWithoutTaskWhichAreCompleted).length;
        filtersFullList['_workflowCompletedWithoutTaskHidden'] = {
            display: 'Exclude old completed workflows',
            help: 'Some older workflows no longer have a task record, '+
                'either because they completed in a previous server prior to a server restart or failover, ' +
                'or because their tasks have been cleared from memory in this server. ' +
                'These can be excluded to focus on more recent tasks.',
            displaySummary: null,
            filter: tasks => tasks.filter(filterWorkflowsWithoutTaskWhichAreCompleted),
            count: countWorkflowsWithoutTaskWhichAreCompleted,
            countAbsolute: countWorkflowsWithoutTaskWhichAreCompleted,
            categoryForEvaluation: 'workflow2',
            category: 'workflow',
        }

        // fill in fields
        function updateSelectedFilters(newValues) {
            Object.entries(scope.filters.selectedFilters).forEach(([filterId, oldValue]) => {
                const newValue = newValues[filterId];
                scope.filters.selectedFilters[filterId] = newValue;
                if (!newValue) delete scope.filters.selectedFilters[filterId];
            });
        }

        updateSelectedFilters(filtersFullList);

        // add counts
        Object.entries(filtersFullList).forEach(([k, f]) => {
            if (!f.select) f.select = defaultToggleFilter;
            if (!f.onClick) f.onClick = (filterId, filter) => defaultToggleFilter(filterId, filter, null, true);

            if (_.isNil(f.count)) f.count = scope.findTasksExcludingCategory(f.filter(tasks), scope.filters.selectedFilters, f.category).length;
            if (_.isNil(f.countAbsolute)) f.countAbsolute = f.filter(tasks).length;
        });

        // filter and move to new map
        let result = {};
        Object.entries(filtersFullList).forEach(([k, f]) => {
            if (f.countAbsolute > 0 || f.includeIfZero) result[k] = f;
        });

        // and delete categories that are redundant
        function deleteCategoryIfAllCountsAreEqualOrZero(category) {
            if (_.uniq(Object.values(result).filter(f => f.category === category).filter(f => f.countAbsolute).map(f => f.countAbsolute)).length==1) {
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
        deleteCategoryIfAllCountsAreEqualOrZero('type-tag');  // because all tags are on all tasks

        if (!result['_cross_entity'] && result['_recursive']) {
            // if we don't have cross-entity sub-tasks, tidy this message
            result['_recursive'].display = 'Include sub-tasks';
        }

        // // but if we deleted everything, restore them (better to have pointless categories than no categories)
        // if (!Object.keys(result).length) result = filtersIncludingTags;


        // now add dividers between categories
        let lastCat = null;
        for (let v of Object.values(result)) {
            let thisCat = v.categoryForDisplay || v.category;
            if (lastCat!=null && lastCat!=thisCat) {
                v.classes = (v.classes || '') + ' divider-above';
            }
            lastCat = thisCat;
        }

        scope.filters.available = result;
        updateSelectedFilters(result);

        return result;
    }
}

const filterWorkflowsReplayedNested = t => !t.isWorkflowFirstRun && t.isWorkflowLastRun && !t.isWorkflowTopLevel;

function isScheduled(task) {
  return task && task.currentStatus && task.currentStatus.startsWith("Schedule");
}

function isTopLevelTask(t, tasksById) {
    if (filterWorkflowsReplayedNested(t)) return false;
    if (!t.submittedByTask) return true;
    if (t.forceTopLevel) return true;
    if (t.tags && t.tags.includes("TOP-LEVEL")) return true;
    let submitter = tasksById[t.submittedByTask.metadata.id];

    // we could include those which are submitted but the submitter is forgotten
    // (but they are accesible as CrossEntity or NestedSameEntity so don't include for now)
    //if (!submitted) return true;

    // active scheduled tasks
    //if (isScheduled(submitter) && (!t.endTimeUtc || t.endTimeUtc<=0)) return true;

    return false;
}
function isNonTopLevelTask(t, tasksById) {
    return !isTopLevelTask(t, tasksById);
}
function isCrossEntityTask(t, tasksById) {
    if (isTopLevelTask(t, tasksById)) return false;
    return t.submittedByTask && t.submittedByTask.metadata.entityId !== t.entityId;
}
function isNestedSameEntityTask(t, tasksById) {
    if (isTopLevelTask(t, tasksById)) return false;
    return t.submittedByTask && t.submittedByTask.metadata.entityId === t.entityId;
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
        Object.values(globalFilters || {}).filter(gf => !gf.include).forEach(gf => {
            inputs = gf.filter(inputs);
        });
    }
    return inputs;
}

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
