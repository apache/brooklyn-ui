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
import template from "./task-list.template.html";

const MODULE_NAME = 'inspector.task-list';

angular.module(MODULE_NAME, [])
    .directive('taskList', taskListDirective)
    .filter('timeAgoFilter', timeAgoFilter)
    .filter('durationFilter', durationFilter)
    .filter('activityTagFilter', activityTagFilter)
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

        setFiltersForTasks($scope, isActivityChildren);
        $scope.filterValue = $scope.search;

        $scope.model = {
            appendTo: $element,
            filterResult: null,
            filterByTag: isActivityChildren ? $scope.filters['_top']
                : $scope.taskType === 'activity' ? $scope.filters['_effectorsTop']
                : $scope.filters[$scope.taskType || '_effectorsTop'],
        };

        const activityTagFilterApplication = () => activityTagFilter()($scope.tasks, [$scope.model.filterByTag, $scope.globalFilters]);
        if ((!$scope.taskType || $scope.taskType.startsWith('activity')) && (!$scope.model.filterByTag || activityTagFilterApplication().length==0 )) {
            // show all if default view is empty, unless explicit tag was requested
            $scope.model.filterByTag = $scope.filters['_top'];
            if (!$scope.model.filterByTag || activityTagFilterApplication().length == 0 ) {
                $scope.model.filterByTag = $scope.filters['_recursive'] || $scope.model.filterByTag;
            }
        }
        $scope.isScheduled = isScheduled;

        $scope.$watch('tasks', ()=>{
            setFiltersForTasks($scope, isActivityChildren);
        });
        $scope.getTaskDuration = function(task) {
            if (!task.startTimeUtc) {
                return null;
            }
            return (task.endTimeUtc === null ? new Date().getTime() : task.endTimeUtc) - task.startTimeUtc;
        }

        $scope.$watch('model.filterResult', function () {
            if ($scope.filteredCallback && $scope.model.filterResult) $scope.filteredCallback()( $scope.model.filterResult, $scope.globalFilters );
        });
    }

    function tagReducer(result, tag) {
        if (typeof tag === 'string') {
            if (result.hasOwnProperty(tag)) {
                result[tag].count ++;
            } else {
                result[tag] = {
                    display: 'Tag: '+tag.toLowerCase(),
                    tag,
                    count: 1,
                }
            }
        }
        return result;
    }

    function setFiltersForTasks(scope, isActivityChildren) {
        const tasksAll = scope.tasks || [];
        const globalFilters = scope.globalFilters;

        // include a toggle for transient tasks
        if (!globalFilters.transient) {
            const numTransient = tasksWithTag(tasksAll, 'TRANSIENT').length;
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
        const tops = topLevelTasks(tasks);

        let defaultTags = {};
        defaultTags['_top'] = {
            display: 'All top-level tasks',
            filter: topLevelTasks,
            count: tops.length,
        }
        if (tasks.length > tops.length) {
            defaultTags['_recursive'] = {
                display: 'All tasks (recursive)',
                filter: input => input,
                count: tasks.length,
            }
        }
        defaultTags['_effectorsTop'] = {
            display: 'Effectors (top-level)',
            filter: tt => tasksWithTag(topLevelTasks(tt), 'EFFECTOR'),
            count: tasksWithTag(tops, 'EFFECTOR').length,
        }
        defaultTags['EFFECTOR'] = {
            display: 'Effectors (recursive)',
            tag: 'EFFECTOR',
            count: 0,
        }
        if (isActivityChildren) {
            defaultTags['_top'].display = 'Direct sub-tasks';
            if (defaultTags['_recursive']) defaultTags['_recursive'].display = 'All sub-tasks (recursive)';
        }

        const result = tasks.reduce((result, subTask)=> {
            return subTask.tags.reduce(tagReducer, result);
        }, defaultTags);

        // could suppress if no effectors
        // if (!result['_effectorsTop'].count) {
        //     delete result['_effectorsTop'];
        //     if (!result['EFFECTOR'].count) {
        //         delete result['EFFECTOR'];
        //     }
        // }

        scope.filters = result; //previously we extended, but now allow to clear
        return result;
    }
}


function isScheduled(task) {
  return task && task.currentStatus && task.currentStatus.startsWith("Schedule");
}

function isTopLevelTask(t, tasksById) {
    if (!t.submittedByTask) return true;
    let submitter = tasksById[t.submittedByTask.metadata.id];
    if (!submitter) return true;
    if (isScheduled(submitter) && (!t.endTimeUtc || t.endTimeUtc<=0)) return true;
    return false;
}

function topLevelTasks(tasks) {
    if (!tasks) return tasks;
    let tasksById = tasks.reduce( (result,t) => { result[t.id] = t; return result; }, {} );
    return tasks.filter(t => isTopLevelTask(t, tasksById));
}

export function timeAgoFilter() {
    function timeAgo(input) {
        return fromNow(input);
    }

    timeAgo.$stateful = true;

    return timeAgo;
}
export function durationFilter() {
    return function (input) {
        return duration(input);
    }
}

function isTaskWithTag(task, tag) {
    return task.tags.indexOf(tag)>=0;
}

function tasksWithTag(tasks, tag) {
    return tasks.filter(t => isTaskWithTag(t, tag));
}

function tasksAfterGlobalFilters(inputs, globalFilters) {
    if (inputs) {
        if (globalFilters && globalFilters.transient && !globalFilters.transient.include) {
            inputs = inputs.filter(t => !isTaskWithTag(t, 'TRANSIENT'));
        }
    }
    return inputs;
}

export function activityTagFilter() {
    return function (inputs, args) {
        const [tagF, globalFilters] = args;
        inputs = tasksAfterGlobalFilters(inputs, globalFilters);
        if (inputs && tagF) {
            const filter = tagF.filter || (tagF.tag ? inp => tasksWithTag(inp, tagF.tag) : null);
            if (!filter) {
                console.warn("Incomplete activities tag filter", tagF);
                return inputs;
            }
            return filter(inputs);
        } else {
            if (inputs) console.warn("Unknown activities tag filter", tagF);
            return inputs;
        }
    }
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
