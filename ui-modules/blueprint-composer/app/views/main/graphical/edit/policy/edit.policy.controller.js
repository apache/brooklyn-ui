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
import template from './edit.policy.template.html';

export function EditPolicyController($scope, policy) {
    $scope.policy = policy;
}

export const graphicalEditPolicyState = {
    name: 'main.graphical.edit.policy',
    url: '/policy/:policyId',
    template: template,
    controller: ['$scope', 'policy', EditPolicyController],
    controllerAs: 'vm',
    resolve: {
        policy: ['$stateParams', 'entity', function($stateParams, entity) {
            return entity.policies.get($stateParams.policyId);
        }]
    }
};