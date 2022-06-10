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
import angularElastic from "angular-elastic";
import directiveTemplate from "./entity-effector.html";
import modalTemplate from "./modal/modal.template.html";
import cliModalTemplate from "./modal/cli-modal.template.html";
import {modalController} from "./modal/modal.controller";

const MODULE_NAME = 'inspector.entity.effector';

angular.module(MODULE_NAME, [angularElastic])
    .directive('entityEffector', ['$state', entityEffectorDirective]);

export default MODULE_NAME;

export function entityEffectorDirective($state) {
    return {
        restrict: 'E',
        template: directiveTemplate,
        scope: {
            effector: '<',
            applicationId : '@',
            entityId : '@',
            open : '<',
        },
        controller: ['$scope','$state','$http','$uibModal', controller]
    };

    function controller ($scope, $state, $http, $uibModal){
        $scope.openModal =  function() {
            let instance = $uibModal.open({
                animation: true,
                template: modalTemplate,
                controller: ['$scope', '$state', 'entityApi', 'locationApi', 'effector', 'applicationId', 'entityId', modalController],
                controllerAs: 'vm',
                size: '',
                resolve: {
                    effector: ()=> {
                        return $scope.effector
                    },
                    applicationId: () => $scope.applicationId,
                    entityId: () => $scope.entityId
                }
            });
        }
        if ($scope.open) $scope.openModal();

        $scope.openCliModal =  function() {
            let instance = $uibModal.open({
                animation: true,
                template: cliModalTemplate,
                controller: ['$scope', 'effector', 'applicationId', 'entityId', ($scope, effector, applicationId, entityId) => {
                    $scope.effector = effector;

                    $scope.cliParams = () => {
                        return $scope.effector.parameters.reduce((ret, parameter, index) => ret + (index ? '\n' : '')
                            + parameter.name + '=' + parameter.type.replace('java.lang.', '').toUpperCase()
                            + (parameter.description ? ' # ' +  parameter.description : ''), '');
                    }

                    $scope.curlCmd = () => {
                        let parameters = $scope.effector.parameters.reduce((ret, parameter, index) => ret + (index ? ', "' : '"') + parameter.name + '": "$' + parameter.name + '"', '');
                        return 'curl -u username:password -X POST -H \'Accept: application/json\' -H \'Content-Type: application/json\' '
                            + window.location.protocol + '//' + window.location.host + $scope.effector.links.self
                            + (parameters ? ' -d \'{' + parameters + '}\'' : '');
                    }

                    $scope.brCmd = () => {
                        let parameters = $scope.effector.parameters.reduce((ret, parameter) => ret + ' ' + parameter.name + '=$' + parameter.name, '');
                        return `br app ${applicationId} ent ${entityId} effector ${$scope.effector.name} invoke` + (parameters ? ' -param' + parameters : '');
                    }
                }],
                size: '',
                resolve: {
                    effector: () => $scope.effector,
                    applicationId: () => $scope.applicationId,
                    entityId: () => $scope.entityId
                }
            });
        }
    }
}
