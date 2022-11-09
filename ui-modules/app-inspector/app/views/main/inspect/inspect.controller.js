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
import template from "./inspect.template.html";
import addChildModalTemplate from "./add-child-modal.template.html";
import runWorkflowModalTemplate from "./run-workflow-modal.template.html";
import confirmModalTemplate from "./confirm.modal.template.html";

export const inspectState = {
    abstract: true,
    name: 'main.inspect',
    url: 'application/:applicationId/entity/:entityId',
    template: template,
    controller: ['$scope', '$state', '$stateParams', '$uibModal', 'brSnackbar', 'entityApi', inspectController],
    controllerAs: 'vm'
};

export function inspectController($scope, $state, $stateParams, $uibModal, brSnackbar, entityApi) {
    const {
        applicationId,
        entityId
    } = $stateParams;

    let vm = this;
    vm.entityNotFound = false;

    let observers = [];
    entityApi.entity(applicationId, entityId).then((response)=> {
        vm.entity = response.data;
        observers.push(response.subscribe((response)=> {
            vm.entity = response.data;
        }, (response)=> {
            vm.entityNotFound = true;
        }));
    }).catch((error)=> {
        vm.entityNotFound = true;
    });

    $scope.$on('$destroy', ()=> {
        observers.forEach((observer)=> {
            observer.unsubscribe();
        });
    });

    this.addChildToEntity = function() {
        $uibModal.open({
            animation: true,
            template: addChildModalTemplate,
            controller: ['$scope', '$http', '$uibModalInstance', 'applicationId', 'entityId', addChildController],
            size: 'lg',
            resolve: {
                applicationId: ()=>(applicationId),
                entityId: ()=>(entityId),
            }
        }).result.then((closeData)=> {
            $state.go('main.inspect.activities.detail', {
                applicationId: applicationId,
                entityId: closeData.entityId,
                activityId: closeData.id
            });
        })
    };

    this.runWorkflow = function() {
        $uibModal.open({
            animation: true,
            template: runWorkflowModalTemplate,
            controller: ['$scope', '$http', '$uibModalInstance', 'serverApi', 'applicationId', 'entityId', runWorkflowController],
            size: 'lg',
            resolve: {
                applicationId: ()=>(applicationId),
                entityId: ()=>(entityId),
            }
        }).result.then((closeData)=> {
            $state.go('main.inspect.activities.detail', {
                applicationId: applicationId,
                entityId: closeData.entityId,
                activityId: closeData.id
            });
        })
    };

    this.resetEntityProblems = function() {
        entityApi.resetEntityProblems(applicationId, entityId).catch((error)=> {
            brSnackbar.create('Cannot reset entity problems: the entity [' + entityId + '] or sensor [service.notUp.indicators] is undefined');
        });
        return false;
    };

    this.expungeEntity = function(release = true) {
        let modalScope = $scope.$new(true);
        modalScope.release = release;

        $uibModal.open({
            template: confirmModalTemplate,
            scope: modalScope
        }).result.then((result)=> {
            brSnackbar.create('Entity [' + entityId + '] is being submitted to be ' + (release ? 'expunged' : 'unmanaged'));
            entityApi.expungeEntity(applicationId, entityId, release).then((response)=> {
                brSnackbar.create('Entity [' + entityId + '] is in the process of being ' + (release ? 'expunged' : 'unmanaged')
                    + '. ' + 'If this is not immediate, the details can be found in the activites tab by applying suitable filters.');
            }).catch((error)=> {
                brSnackbar.create('Cannot expunge entity problems: the entity [' + entityId + '] is undefined');
            });
        });
    };
}

export function addChildController($scope, $http, $uibModalInstance, applicationId, entityId) {
    $scope.childEntityYaml = 'services:\n  - type: ';
    $scope.errorMessage = null;
    $scope.deploying = false;
    $scope.addChild = addChild;

    function addChild() {
        $scope.deploying = true;
        $scope.errorMessage = null;
        $http.post('/v1/applications/' + applicationId + '/entities/' + entityId + '/children?start=true&timeout=20ms', $scope.childEntityYaml)
            .then((response)=> {
                $scope.deploying = false;
                $uibModalInstance.close(response.data);
            }, (error)=> {
                console.log("Error adding child", error);
                $scope.deploying = false;
                if (error.data.hasOwnProperty('message')) {
                    $scope.errorMessage = error.data.message;
                } else {
                    $scope.errorMessage = 'Could not add child ... unknown error';
                }
            });
    }
}

export function runWorkflowController($scope, $http, $uibModalInstance, serverApi, applicationId, entityId, workflowYaml) {
    $scope.workflowYaml = workflowYaml;
    $scope.errorMessage = null;
    $scope.running = false;
    $scope.runWorkflow = runWorkflow;

    if (!$scope.workflowYaml) {
        function initWorkflowYaml() {
            if (!$scope.workflowYaml) {
                $scope.workflowYaml = 'name: Workflow via UI' + ($scope.user ? ' ' + $scope.user : '') + '\n' + 'steps:\n  - ';
            }
        }
        serverApi.getUser().then((response) => {
            $scope.user = response.data;
            initWorkflowYaml();
        }).catch((response) => {
            $scope.user = null;
            initWorkflowYaml();
        });
    }

    function runWorkflow() {
        $scope.running = true;
        $scope.errorMessage = null;
        $http.post('/v1/applications/' + applicationId + '/entities/' + entityId + '/workflows?start=true&timeout=20ms', $scope.workflowYaml)
            .then((response)=> {
                $scope.running = false;
                $uibModalInstance.close(response.data);
            }, (error)=> {
                console.log("Error running workflow", error);
                $scope.running = false;
                if (error.data.hasOwnProperty('message')) {
                    $scope.errorMessage = error.data.message;
                } else {
                    $scope.errorMessage = 'Could not run workflow ... unknown error';
                }
            });
    }
}
