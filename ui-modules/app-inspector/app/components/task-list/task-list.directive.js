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
import moment from "moment";
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
            taskType: '@'
        },
        controller: ['$scope', '$element', controller]
    };

    function controller($scope, $element) {
        $scope.model = {
            appendTo: $element,
            filterByTag: $scope.taskType === 'activityChildren' ? 'SUB-TASK' : 'EFFECTOR'
        };
        
        if (activityTagFilter()($scope.tasks, $scope.model.filterByTag).length == 0) {
            // show all if there are no sub-tasks
            $scope.model.filterByTag = 'ALL';
        }

        $scope.$watch('tasks', function () {
            let defaultTags = {'ALL': $scope.tasks.length};
            if ($scope.taskType === 'activityChildren') {
                defaultTags['SUB-TASK'] = 0;
            }
            let tags = $scope.tasks.reduce((result, subTask)=> {
                return subTask.tags.reduce(tagReducer, result);
            }, defaultTags);
            $scope.filters = angular.extend(tags, $scope.filters);
        });
        $scope.getTaskDuration = function(task) {
            if (!task.startTimeUtc) {
                return null;
            }
            return (task.endTimeUtc === null ? new Date().getTime() : task.endTimeUtc) - task.startTimeUtc;
        }
    }

    function tagReducer(result, tag) {
        if (typeof tag === 'string') {
            if (result.hasOwnProperty(tag)) {
                result[tag]++;
            } else {
                result[tag] = 1;
            }
        }
        return result;
    }
}

export function timeAgoFilter() {
    function timeAgo(input) {
        if (input) {
            return moment(input).fromNow();
        }
    }

    timeAgo.$stateful = true;

    return timeAgo;
}
export function durationFilter() {
    return function (input) {
        if (angular.isNumber(input)) {
            if (input==0) { return "a fraction of a millisecond"; }
            if (input<100) { return "a few milliseconds"; }
            if (input<1000) { return "a fraction of a second"; }
            return moment.duration(input).humanize();
        }
    }
}

export function activityTagFilter() {
    return function (inputs, tag) {
        if (inputs && tag && tag !== 'ALL') {
            return inputs.reduce((result, task)=> {
                if (task.tags.indexOf(tag) != -1) {
                    result.push(task);
                }
                return result;
            }, []);
        } else {
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
