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

const MODULE_NAME = 'brooklyn.components.catalog-saver';
const TEMPLATE_URL = 'blueprint-composer/component/catalog-saver/index.html';
const TEMPLATE_MODAL_URL = 'blueprint-composer/component/catalog-saver/modal.html';

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
    .directive('catalogSaver', ['$rootScope', '$uibModal', '$injector', 'composerOverrides', 'blueprintService', saveToCatalogModalDirective])
    .directive('catalogVersion', ['$parse', catalogVersionDirective])
    .run(['$templateCache', templateCache]);

export default MODULE_NAME;

export function saveToCatalogModalDirective($rootScope, $uibModal, $injector, composerOverrides, blueprintService) {
    return {
        restrict: 'E',
        templateUrl: function (tElement, tAttrs) {
            return tAttrs.templateUrl || TEMPLATE_URL;
        },
        scope: {
            config: '=',
        },
        link: link
    };

    function link($scope, $element) {
        $scope.buttonText = $scope.config.label || ($scope.config.itemType ? `Update ${$scope.config.name || $scope.config.symbolicName}` : 'Add to catalog');

        $scope.activateModal = () => {
            let entity = blueprintService.get();
            let metadata = blueprintService.entityHasMetadata(entity) ? blueprintService.getEntityMetadata(entity) : new Map();

            // Reset the config values if this is not an update
            $scope.isUpdate = Object.keys($scope.config).length > ($scope.config.label ? 1 : 0);
            if (!$scope.isUpdate) {
                $scope.config.template = true;
                $scope.config.entity = false;
            }

            // Set various properties from the blueprint entity data
            if (!$scope.config.version && (entity.hasVersion() || metadata.has('version'))) {
                $scope.config.version = entity.version || metadata.get('version');
            }
            if (!$scope.config.iconUrl && (entity.hasIcon() || metadata.has('iconUrl'))) {
                $scope.config.iconUrl = entity.icon || metadata.get('iconUrl');
            }
            if (!$scope.config.name && entity.hasName()) {
                $scope.config.name = entity.name;
            }
            if (!$scope.config.symbolicName && (entity.hasId() || metadata.has('id'))) {
                $scope.config.symbolicName = entity.id || metadata.get('id');
            }
            if (!$scope.config.bundle) {
                let bundle = $scope.config.symbolicName || $scope.config.name || 'untitled';
                $scope.config.bundle = bundle.split(/[^-a-zA-Z0-9._]+/).join('-').toLowerCase();
                if (!$scope.config.symbolicName) {
                    $scope.config.symbolicName = $scope.config.bundle;
                }
            }

            // Override this callback to update configuration data elsewhere
            $scope.config = (composerOverrides.updateCatalogConfig || ((config, $element) => config))($scope.config, $element);

            let modalInstance = $uibModal.open({
                templateUrl: TEMPLATE_MODAL_URL,
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
    };

    $scope.getTitle = () => {
        switch ($scope.state.view) {
            case VIEWS.form:
                return $scope.isUpdate ? `Update ${$scope.config.name || $scope.config.symbolicName}` : 'Add to catalog';
            case VIEWS.saved:
                return `${$scope.config.name || $scope.config.symbolicName} ${$scope.isUpdate ? 'updated' : 'saved'}`;
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
            item: blueprint
        };

        // Set the itemType to the correct value or leave out entirely if config undefined
        let itemType = $scope.config.entity ? 'entity' : $scope.config.template ? 'template' : undefined;
        if (itemType) {
            bomItem.itemType = itemType;
        }

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

    function link(scope, elm, attr, ctrl) {
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

function templateCache($templateCache) {
    $templateCache.put(TEMPLATE_URL, template);
    $templateCache.put(TEMPLATE_MODAL_URL, modalTemplate);
}
