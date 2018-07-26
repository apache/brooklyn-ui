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
import uibModal from 'angular-ui-bootstrap/src/modal/index-nocss';
import expandablePanelTemplate from './expandable-panel.template.html';

const MODULE_NAME = 'brooklyn.components.expandable-panel';

angular.module(MODULE_NAME, [uibModal])
    .directive('expandablePanel', expandablePanelDirective);

export default MODULE_NAME;

export function expandablePanelDirective() {
    return {
        restrict: 'E',
        transclude: { 'heading': '?heading', 'extraButtons': '?extraButtons' },
        template: expandablePanelTemplate,
        controller: ['$scope', '$attrs', '$uibModal', controller],
        controllerAs: 'ctrl'
    };

    function controller($scope, $attrs, $uibModal) {
        let ctrl = this;

        ctrl.expand = () => {
            let options = {
                size: 'lg',
                scope: $scope
            };

            if ($attrs.expandableTemplate) {
                options.template = $scope.$eval($attrs.expandableTemplate);
            }
            if ($attrs.expandableTemplateUrl) {
                options.templateUrl = $attrs.expandableTemplateUrl;
            }
            if ($attrs.expandableSize) {
                options.size = $attrs.expandableSize;
            }

            $uibModal.open(options);
        }
    }
}
