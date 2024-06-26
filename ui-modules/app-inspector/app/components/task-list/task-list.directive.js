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
            entityId: '<?',
            contextKey: '@?', // a key to uniquely identify the calling context to save filter settings
            activityColumnTitle: '@?',
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
                                console.warn("Incomplete activities tag filter", f);
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
                    $scope.filters.selectedFilters, '')
                .sort((t1,t2) => {
                    if (!t1.endTimeUtc || !t2.endTimeUtc) {
                        if (!t1.endTimeUtc && !t2.endTimeUtc) return t2.startTimeUtc - t1.startTimeUtc;
                        if (t1.endTimeUtc) return 1;
                        return -1;
                    }
                    return t2.endTimeUtc - t1.endTimeUtc ||
                        // if same end time, sort by start time
                        (t2.startTimeUtc && t1.startTimeUtc && t2.startTimeUtc - t1.startTimeUtc) ||
                        (t2.submitTimeUtc && t1.submitTimeUtc && t2.submitTimeUtc - t1.submitTimeUtc);
                });

            // do this to update the counts
            setFiltersForTasks($scope, isActivityChildren);

            // now update name
            const enabledCategories = _.uniq(Object.values($scope.filters.selectedFilters).map(f => f.category));
            $scope.filters.selectedDisplay = [];
            Object.entries($scope.filters.displayNameFunctionForCategory).forEach(([category, nf]) => {
                if (!enabledCategories.includes(category)) return null;
                let badges = nf ? nf(Object.values($scope.filters.selectedFilters).filter(f => (f.categoryForBadges || f.category) === category)) : null;
                badges = (badges || []).filter(x=>x);
                if (badges.length) $scope.filters.selectedDisplay.push({ class: 'dropdown-category-'+category, badges });
            });
            if (!$scope.filters.selectedDisplay.length) $scope.filters.selectedDisplay.push({ class: 'dropdown-category-default', badges: ['all'] });
        };

        function selectFilter(filterId, explicitNewValueOrUndefinedForToggle) {
            //console.debug("selecting filter: "+filterId+" = "+explicitNewValueOrUndefinedForToggle);
            const f = $scope.filters.available[filterId];
            if (!f) {
                //console.debug("selected filter not found; available are", $scope.filters.available);
                // we tried to select eg effector, when it didn't exist, just ignore
                return false;
            } else {
                f.select(filterId, f, explicitNewValueOrUndefinedForToggle); // see defaultToggleFilter for params
                return true;
            }
        }
        $scope.clickFilter = (filter, tag) => {
            filter.onClick(tag, filter);
            if ($scope.contextKey) {
                try {
                    const filters = JSON.stringify(Object.keys($scope.filters.selectedFilters));
                    const storageKey = 'brooklyn-task-list-filters-' + $scope.contextKey;
                    sessionStorage.setItem(storageKey, filters);
                    //console.debug("Saved filters to session storage", storageKey, filters);
                } catch (e) {
                    console.warn("Unable to save filiters from session storage for", $scope.contextKey, e);
                }
            }
        }

        $scope.filterValue = $scope.search;

        $scope.isScheduled = isScheduled;

        function roundChangingMillis(x) {
            if (x<100) return "-";
            if (x<1000) return Math.round(x/100)*100;
            return Math.round(x/1000)*1000;
        }

        $scope.getTaskDuration = function(task) {
            if (!task.startTimeUtc) {
                return null;
            }
            if (!_.isNil(task.endTimeUtc) && task.endTimeUtc <= 0) return null;
            return (task.endTimeUtc === null ? roundChangingMillis(new Date().getTime() - task.startTimeUtc) : task.endTimeUtc - task.startTimeUtc);
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
        let filtersFromSessionStorage = 'initializing';  // | 'absent' | 'loaded'

        $scope.resetFilters = () => {
            tasksLoadedTrueReceived = false;
            $scope.uiDropdownInteraction = false;
            filtersFromSessionStorage = 'initializing';
            sessionStorage.removeItem('brooklyn-task-list-filters-' + $scope.contextKey)
            refreshDropdownsUntilTasksAreLoaded();
        }

        function refreshDropdownsUntilTasksAreLoaded() {
            if (tasksLoadedTrueReceived || $scope.uiDropdownInteraction) return;
            tasksLoadedTrueReceived = $scope.tasksLoaded;

            let preselectedFilters;
            if (filtersFromSessionStorage=='initializing') {
                if (!$scope.contextKey) filtersFromSessionStorage = 'absent';
                else {
                    filtersFromSessionStorage = 'absent';
                    try {
                        const filters = sessionStorage.getItem('brooklyn-task-list-filters-' + $scope.contextKey);
                        if (filters) {
                            // console.debug("Read filters for", $scope.contextKey, filters);
                            preselectedFilters = JSON.parse(filters);
                        }
                    } catch (e) {
                        console.warn("Unable to load filiters from session storage for", $scope.contextKey, e);
                    }
                }
            }
            if (filtersFromSessionStorage=='loaded') {
                // don't auto-compute if taken from session storage
            } else {

                $scope.filters = {available: {}, selectedFilters: {}};
                setFiltersForTasks($scope, isActivityChildren);

                if (preselectedFilters) {
                    try {
                        if ($scope.selectedFilters) Object.entries($scope.selectedFilters, (k,v) => selectFilter(k, v, false));

                        $scope.selectedFilters = {};
                        preselectedFilters.forEach(fid => {
                            const f = $scope.filters.available[fid];
                            if (!f) {
                                // don't keep retrying the load, unless tasks aren't loaded yet
                                if (!$scope.tasksLoaded) {
                                    filtersFromSessionStorage = 'initializing';  // we don't have all the filters yet
                                }
                            } else {
                                selectFilter(fid, f, true);
                            }
                        });
                        filtersFromSessionStorage = 'loaded';
                    } catch (e) {
                        filtersFromSessionStorage = 'absent';
                        console.warn("Unable to process filiters from session storage for", $scope.contextKey, preselectedFilters, e);
                    }
                }

                if (filtersFromSessionStorage == 'absent') {

                    selectFilter("_top", true);
                    selectFilter("_anyTypeTag", true);
                    if ($scope.taskType) {
                        if ($scope.taskType == "ALL") {
                            selectFilter("_top", false);
                        } else {
                            selectFilter($scope.taskType);
                        }
                    } else {
                        selectFilter('_cross_entity');
                        selectFilter('_all_effectors');
                        selectFilter('TOP-LEVEL');
                        selectFilter('EFFECTOR');
                        selectFilter('WORKFLOW');
                        selectFilter('_periodic');
                        selectFilter('_other_entity');

                        if (isActivityChildren) {
                            // in children mode we also want sub-tasks
                            // (previously selected no filters in subtask view)
                            selectFilter('SUB-TASK');
                        }
                    }
                    if (!isActivityChildren) selectFilter("_workflowStepsHidden");
                    selectFilter("_workflowReplayedTopLevel");
                    selectFilter("_workflowNonLastReplayHidden");
                    selectFilter("_workflowCompletedWithoutTaskHidden");

                    // pick other filter combos until we get some conetnt
                    if ($scope.tasksFilteredByTag.length == 0) {
                        selectFilter('INITIALIZATION');
                    }
                    if ($scope.tasksFilteredByTag.length == 0) {
                        selectFilter("_anyTypeTag", true);
                    }
                    if (!isActivityChildren && $scope.tasksFilteredByTag.length == 0) {
                        selectFilter("_top", false);
                    }
                }
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

        function defaultToggleFilter(tag, filter, forceValue, fromUi, skipRecompute) {
            if ((scope.filters.selectedFilters[tag] && _.isNil(forceValue)) || forceValue===false) {
                delete scope.filters.selectedFilters[tag];
                if (filter.onDisabledPost) filter.onDisabledPost(tag, filter, forceValue);
            } else {
                if (filter.onEnabledPre) filter.onEnabledPre(tag, filter, forceValue);
                scope.filters.selectedFilters[tag] = filter;
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
        const isChild = (t,tbyid) => {
            if (!t.submittedByTask) return false;
            return (t.submittedByTask.metadata.id == scope.parentTaskId);
        };
        const isNotChild = (t,tbyid) => !isChild(t, tbyid);
        function filterTopLevelTasks(tasks) {
            return filterWithId(tasks, tasksById, isActivityChildren ? isChild : isTopLevelTask);
        }
        function filterNonTopLevelTasks(tasks) {
            return filterWithId(tasks, tasksById, isActivityChildren ? isNotChild : isNonTopLevelTask);
        }
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
                    // everything but first is selected, so no message (assume _top is always shown)
                    let statusFiltersEnabled = Object.values(scope.filters.selectedFilters).filter(f => f.category === 'status');
                    if (statusFiltersEnabled.length) return [ 'some' ];  // if filters applied, indicate that
                    else return [ 'all' ];
                }
                if (set.length > 1) return [ 'some' ];  // gets too big otherwise
                return set.map(s => s.displaySummary || '');
            },
            'type-tag': set => {
                if (!set || !set.length) return null;
                if (set.length<=3) {

                    if (scope.filters.selectedFilters['_all_effectors'] &&
                            Object.values(scope.filters.selectedFilters).filter(f => f.category === 'nested').length==1) {
                        // if all_effectors is the only nesting don't show '(effectors) (effector)'
                        set = set.filter(x => x.displaySummary != 'effector');  // don't show 'effectors' and effector
                    }

                    return set.map(s => (getFilterOrEmpty(s).displaySummary || '').toLowerCase()).filter(x => x);
                } else {
                    return ['any of '+set.length+' tags'];
                }
            },
        };
        filtersFullList['_top'] = {
            display: 'Only list ' + (isActivityChildren ? 'children sub-tasks' : 'top-level tasks'),
            displaySummary: 'only top-level',
            isDefault: true,
            filter: filterTopLevelTasks,  // redundant with starting set, but contributes the right count
            category: 'nested',
            onEnabledPre: clearCategory(),
            onDisabledPost: enableOthersIfCategoryEmpty('_top'),
            includeIfZero: true,
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
                display: 'Include local sub-tasks',
                displaySummary: 'local',
                filter: filterNestedSameEntityTasks,
                category: 'nested',
                onEnabledPre: clearOther('_top'),
                onDisabledPost: enableFilterIfCategoryEmpty('_top'),
            }
            filtersFullList['_all_effectors'] = {
                display: 'Include effector sub-tasks',
                displaySummary: 'effectors',
                filter: filterForTasksWithTag('EFFECTOR'),
                category: 'nested',
                onEnabledPre: clearOther('_top'),
                onDisabledPost: enableFilterIfCategoryEmpty('_top'),
            }
        } else {
            filtersFullList['_recursive'] = {
                display: 'Include recursive sub-tasks',
                displaySummary: 'recursive',
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

        filtersFullList['_periodic'] = {
            display: 'Periodic',
            displaySummary: 'periodic',
            filter: tasks => tasks.filter(t => isScheduled(t)),
            category: 'type-tag',
            onEnabledPre: clearOther('_anyTypeTag'),
            onDisabledPost: enableFilterIfCategoryEmpty('_anyTypeTag'),
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
        filtersFullList['TOP-LEVEL'] = false;
        filtersFullList['inessential'] = false;

        // add filters for other tags
        let tags = _.uniq(tasks.flatMap(t => (t.tags || []).filter(tag => typeof tag === 'string' && tag.length < 32)));
        tags.sort( (t1,t2) => t1.toLowerCase().localeCompare(t2.toLowerCase()) );
        // same tag with different cases will be shown multiple times, unable to disambiguate, but that's unlikely
        tags.forEach(tag => addTagFilter(tag, filtersFullList, 'Tag: ' + tag.toLowerCase()) );

        Object.entries(filtersFullList).forEach(([k,v]) => { if (!v) delete filtersFullList[k]; });
        ['EFFECTOR', 'WORKFLOW', 'SUB-TASK', 'SENSORS', 'INITIALIZATION'].forEach(t => { if (!filtersFullList[t]) delete filtersFullList[t]; });
        (filtersFullList['SENSOR'] || {}).display = 'Sensors';
        (filtersFullList['INITIALIZATION'] || {}).display = 'Initialization';
        (filtersFullList['SUB-TASK'] || {}).display = 'Sub-tasks';
        (filtersFullList['TOP-LEVEL'] || {}).display = 'Important';
        (filtersFullList['TOP-LEVEL'] || {}).displaySummary = 'Important';
        (filtersFullList['inessential'] || {}).display = 'Non-essential';

        filtersFullList['_active'] = {
            display: 'Only show active tasks',
            displaySummary: 'active',
            filter: tasks => tasks.filter(t => !t.endTimeUtc || t.endTimeUtc<0),
            category: 'status',
            categoryForEvaluation: 'status-active',
        }
        if (scope.entityId) {
            filtersFullList['_other_entity'] = {
                display: 'Exclude tasks on other entities',
                displaySummary: 'other-entity',
                filter: tasks => tasks.filter(t => t.entityId === scope.entityId),
                category: 'status',
                categoryForEvaluation: 'other-entity',
                hideBadges: true, // counts don't interact with other filters so it is confusing
            }
        }
        filtersFullList['_scheduled_sub'] = {
            display: 'Only show periodic tasks',
            displaySummary: 'periodic',
            help: 'If debugging a scheduled repeating task such as a policy or sensor, it can be helpful to show only those tasks.',
            filter: tasks => tasks.filter(t => {
                // show scheduled tasks (the parent) and each scheduled run, if sub-tasks are selected
                // if (!t || !t.submittedByTask) return false;  // omit the parent
                if (isScheduled(t, taskId => tasksById[taskId])) return true;
            }),
            category: 'status',
            categoryForEvaluation: 'status-scheduled',
            onEnabledPre: clearOther('_non_scheduled_sub'),
        }
        filtersFullList['_non_scheduled_sub'] = {
            display: 'Exclude periodic sub-tasks',
            displaySummary: 'non-repeating',
            help: 'If there are a lot of repeating tasks, it can be helpful to filter them out '+
                'to find manual and triggers tasks more easily.',
            filter: tasks => tasks.filter(t => {
                return !isScheduled(t, taskId => tasksById[taskId]) ||
                    isScheduled(t) /* allow root periodic task */;
            }),
            category: 'status',
            categoryForEvaluation: 'status-scheduled',
            onEnabledPre: clearOther('_scheduled_sub'),
            hideBadges: true, // counts don't interact with other filters so it is confusing
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
            hideBadges: true, // counts don't interact with other filters so it is confusing
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
            hideBadges: true, // counts don't interact with other filters so it is confusing
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
            categoryForEvaluation: 'workflow-non-last-replays',
            category: 'workflow',
            hideBadges: true, // counts don't interact with other filters so it is confusing
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
            filter: tasks => tasks.filter(t => !filterWorkflowsWithoutTaskWhichAreCompleted(t)),
            count: countWorkflowsWithoutTaskWhichAreCompleted,
            countAbsolute: countWorkflowsWithoutTaskWhichAreCompleted,
            categoryForEvaluation: 'workflow-old-completed',
            category: 'workflow',
            hideBadges: true, // counts don't interact with other filters so it is confusing
        }

        const filterWorkflowTasksWhichAreSteps = t => getTaskWorkflowTag(t) && !_.isNil(getTaskWorkflowTag(t));
        const countWorkflowTasksWhichAreSteps = tasksAll.filter(filterWorkflowTasksWhichAreSteps).length;
        filtersFullList['_workflowStepsHidden'] = {
            display: 'Exclude individual workflow steps',
            help: 'Individual steps within workflows are hidden in most views, except where showing workflow tasks. ' +
                'This makes it easier to navigate to primary tasks, such as workflows, and from there explore the steps within. ' +
                'If this option is disabled and if nested sub-tasks are enabled, then individual steps will be listed in this view ' +
                'to facilitate finding a specific step.',
            displaySummary: null,
            filter: tasks => tasks.filter(t => _.isNil((getTaskWorkflowTag(t) || {}).stepIndex)),
            count: countWorkflowTasksWhichAreSteps,
            countAbsolute: countWorkflowTasksWhichAreSteps,
            categoryForEvaluation: 'workflow-steps',
            category: 'workflow',
            hideBadges: true, // counts don't interact with other filters so it is confusing
        }

        // fill in fields
        function updateSelectedFilters(newValues) {
            //console.debug("selected filters were", Object.keys(scope.filters.selectedFilters));
            Object.entries(scope.filters.selectedFilters).forEach(([filterId, oldValue]) => {
                const newValue = newValues[filterId];
                scope.filters.selectedFilters[filterId] = newValue;
                if (!newValue) delete scope.filters.selectedFilters[filterId];
            });
            //console.debug("selected filters now", Object.keys(scope.filters.selectedFilters));
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
        // include non-zero filters or those included if zero
        Object.entries(filtersFullList).forEach(([k, f]) => {
            if (f.countAbsolute > 0 || f.includeIfZero) result[k] = f;
            //else console.debug("Removing filter", f.display);
        });

        // and delete categories that are redundant
        function deleteCategoryIfAllCountsAreEqualOrZero(category) {
            if (_.uniq(Object.values(result).filter(f => f.category === category).filter(f => f.countAbsolute).map(f => f.countAbsolute)).length==1) {
                Object.entries(result).filter(([k,f]) => f.category === category).forEach(([k,f])=> {
                    //console.debug("Removing category filter", f.display);
                    delete result[k];
                });
            }
        }
        // function deleteFiltersInCategoryThatAreEmpty(category) {
        //     // redundant with population of 'result' above
        //     Object.entries(result).filter(([k,f]) => f.category === category && f.countAbsolute==0 && !f.includeIfZero).forEach(([k,f])=>delete result[k]);
        // }
        function deleteCategoryIfSize1(category) {
            const found = Object.entries(result).filter(([k,f]) => f.category === category);
            if (found.length==1) {
                delete result[found[0][0]];
                //console.debug("Removing size 1 category", found[0][0]);
            }
        }
        // deleteFiltersInCategoryThatAreEmpty('nested');
        deleteCategoryIfSize1('nested');
        deleteCategoryIfAllCountsAreEqualOrZero('type-tag');  // because all tags are on all tasks

        if (!result['_cross_entity'] && result['_recursive']) {
            // if we don't have cross-entity sub-tasks, tidy this message
            result['_recursive'].display = 'Include nested sub-tasks';
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

function isScheduled(task, optionalSubmitterFnIfSubmittersWanted) {
  if (task && task.currentStatus && task.currentStatus.startsWith("Schedule")) return true;
  if (!task || !task.submittedByTask || !optionalSubmitterFnIfSubmittersWanted) return false;
  let submitter = optionalSubmitterFnIfSubmittersWanted(task.submittedByTask.metadata.id);
  return isScheduled(submitter, optionalSubmitterFnIfSubmittersWanted);
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
        // console.log("Task without tags: ", task);
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
