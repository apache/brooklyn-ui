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

export function modalController($scope, $state, entityApi, locationApi, effector, applicationId, entityId, cli) {
    let vm = this;
    vm.error = '';
    vm.effector = effector;
    vm.cli = cli;

    $scope.curlCmd = () => {
        let parameters = vm.effector.parameters.reduce((ret, parameter, index) =>  !parameter.value ? ret : ret + (index ? ', "' : '"') + parameter.name + '": "' + parameter.value + '"', '');
        return 'curl -u username:password -X POST -H \'Accept: application/json\' -H \'Content-Type: application/json\' '
            + window.location.protocol + '//' + window.location.host + vm.effector.links.self
            + (parameters ? ' -d \'{' + parameters + '}\'' : '');
    }

    $scope.brCmd = () => {
        let parameters = vm.effector.parameters.reduce((ret, parameter) => !parameter.value ? ret : ret + ' ' + parameter.name + '="' + parameter.value + '"', '');
        return `br app ${applicationId} ent ${entityId} effector ${vm.effector.name} invoke` + (parameters ? ' -param' + parameters : '');
    }

    $scope.onClipboardSuccess = (e)=> {
        angular.element(e.trigger).triggerHandler('copied');
        e.clearSelection();
    };

    let observers = [];

    locationApi.locations().then((response)=> {
        vm.locations = parseLocations(response.data);
        observers.push(response.subscribe((response)=> {
            vm.locations = parseLocations(response.data);
        }));
    });

    vm.confirmInvoke = function () {
        vm.error = '';
        let parameters = {};
        for (let i = 0; i < vm.effector.parameters.length; i++) {
            parameters[vm.effector.parameters[i].name] = vm.effector.parameters[i].value;
        }

        entityApi.invokeEntityEffector(applicationId, entityId, vm.effector.name, parameters).then((response)=> {
            $scope.$dismiss('Effector sent!');
            $state.go('main.inspect.activities.detail', {
                applicationId: applicationId,
                entityId: entityId,
                activityId: response.data.id
            });
        }).catch((response)=> {
            vm.error = response.data || "Unexpected error";
        });
    };

    $scope.$on('$destroy', ()=> {
        observers.forEach((observer)=> {
            observer.unsubscribe();
        });
    });

    function parseLocations(locations) {
        return locations.map(function (location) {
            let displayName = location.name;
            if (location.catalog && location.catalog.hasOwnProperty('name')) {
                displayName = location.catalog.name + ' (' + location.name + ')'
            }
            return {
                'name': location.name,
                'displayName': displayName
            }
        });
    }
}