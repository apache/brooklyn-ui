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
import angularAnimate from 'angular-animate';
import uibModal from 'angular-ui-bootstrap/src/modal/index-nocss';
import template from './catalog-saver.template.html';
import modalTemplate from './catalog-saver.modal.template.html';
import jsYaml from 'js-yaml';
import brUtils from 'brooklyn-ui-utils/utils/general';
import {yamlState} from "../../views/main/yaml/yaml.state";
import {graphicalState} from "../../views/main/graphical/graphical.state";

const MODULE_NAME = 'brooklyn.components.catalog-saver';

const REASONS = {
    new: 0,
    deploy: 1
};
const VIEWS = {
    form: 0,
    saved: 1
};
const TYPES = [
    {id: 'template', label: 'Application'},
    {id: 'entity', label: 'Entity'}
];

angular.module(MODULE_NAME, [angularAnimate, uibModal, brUtils])
    .directive('catalogSaver', ['$rootScope', '$uibModal', '$injector', 'composerOverrides', saveToCatalogModalDirective])
    .directive('catalogVersion', ['$parse', catalogVersionDirective]);

export default MODULE_NAME;

export function saveToCatalogModalDirective($rootScope, $uibModal, $injector, composerOverrides) {
    return {
        restrict: 'E',
        template: template,
        scope: {
            config: '='
        },
        link: link
    };

    function link($scope, $element) {
        $scope.buttonText = $scope.config.label || ($scope.config.itemType ? `Update ${$scope.config.name || $scope.config.symbolicName}` : 'Add to catalog');

        $injector.get('$templateCache').put('catalog-saver.modal.template.html', modalTemplate);

        $scope.activateModal = () => {
            // Override callback to update catalog configuration data in other applications
            $scope.config = (composerOverrides.updateCatalogConfig || (($scope, $element) => $scope.config))($scope, $element);

            let modalInstance = $uibModal.open({
                templateUrl: 'catalog-saver.modal.template.html',
                size: 'save',
                controller: ['$scope', 'blueprintService', 'paletteApi', 'brUtilsGeneral', CatalogItemModalController],
                scope: $scope,
            });

            // Promise is resolved when the modal is closed. We expect the modal to pass back the action to perform thereafter
            modalInstance.result.then(reason => {
                switch (reason) {
                    case REASONS.new:
                        $rootScope.$broadcast('blueprint.reset');
                        break;
                    case REASONS.deploy:
                        $rootScope.$broadcast('blueprint.deploy');
                        break;
                }
            });
        };
    }
}

export function CatalogItemModalController($scope, blueprintService, paletteApi, brUtilsGeneral) {
    $scope.REASONS = REASONS;
    $scope.VIEWS = VIEWS;
    $scope.TYPES = TYPES;
    $scope.state = {
        pattern: '[\\w\\.\\-\\_]+',
        view: VIEWS.form,
        saving: false,
        force: false,
        isUpdate: Object.keys($scope.config).length > 0
    };

    $scope.getTitle = () => {
        switch ($scope.state.view) {
            case VIEWS.form:
                return $scope.state.isUpdate ? `Update ${$scope.config.name || $scope.config.symbolicName}` : 'Add to catalog';
            case VIEWS.saved:
                return `${$scope.config.name || $scope.config.symbolicName} ${$scope.state.isUpdate ? 'updated' : 'saved'}`;
        }
    };

    $scope.save = () => {
        $scope.state.saving = true;
        $scope.state.error = undefined;

        let bom = createBom();
        paletteApi.create(bom, {forceUpdate: $scope.state.force}).then((savedItem) => {
            if (!angular.isArray($scope.config.versions)) {
                $scope.config.versions = [];
            }
            $scope.config.versions.push($scope.config.version);
            $scope.state.view = VIEWS.saved;
        }).catch(error => {
            $scope.state.error = error.error.message;
        }).finally(() => {
            $scope.state.saving = false;
        });
    };

    function createBom() {
        let blueprint = blueprintService.getAsJson();

        let bomItem = {
            id: $scope.config.symbolicName,
            itemType: $scope.config.itemType,
            item: blueprint
        };
        if (brUtilsGeneral.isNonEmpty($scope.config.name)) {
            bomItem.name = $scope.config.name;
        }
        if (brUtilsGeneral.isNonEmpty($scope.config.description)) {
            bomItem.description = $scope.config.description;
        }
        if (brUtilsGeneral.isNonEmpty($scope.config.iconUrl)) {
            bomItem.iconUrl = $scope.config.iconUrl;
        }

        return jsYaml.dump({
            'brooklyn.catalog': {
                bundle: `catalog-bom-${$scope.config.bundle}`,
                version: $scope.config.version,
                items: [bomItem]
            }
        });
    }
}

export function catalogVersionDirective($parse) {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: link
    };

    function link (scope, elm, attr, ctrl) {
        if (!ctrl) {
            return;
        }

        let matches;
        let force;

        scope.$watch(attr.catalogVersion, value => {
            if (matches !== value) {
                matches = value;
                ctrl.$validate();
            }
        });
        scope.$watch(attr.catalogVersionForce, value => {
            if (force !== value) {
                force = value;
                ctrl.$validate();
            }
        });

        ctrl.$validators.exist = (modelValue, viewValue) => {
            return !angular.isDefined(matches) || ctrl.$isEmpty(viewValue) || viewValue.endsWith('SNAPSHOT') || force === true || matches.indexOf(viewValue) === -1;
        };
    }
}
