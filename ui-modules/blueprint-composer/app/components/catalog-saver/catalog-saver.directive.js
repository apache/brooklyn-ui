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
    .directive('catalogSaver', ['$rootScope', '$uibModal', '$injector', 'composerOverrides', saveToCatalogModalDirective])
    .directive('catalogVersion', ['$parse', catalogVersionDirective])
    .run(['$templateCache', templateCache]);

export default MODULE_NAME;

export function saveToCatalogModalDirective($rootScope, $uibModal, $injector, composerOverrides) {
    return {
        restrict: 'E',
        templateUrl: function (tElement, tAttrs) {
            return tAttrs.templateUrl || TEMPLATE_URL;
        },
        scope: {
            config: '='
        },
        link: link
    };

    function link($scope, $element, $compile, controller) {
        $scope.buttonText = $scope.config.label || ($scope.config.itemType ? `Update ${$scope.config.name || $scope.config.symbolicName}` : 'Add to catalog');

        $scope.activateModal = () => {
            function injectorGet(reference) { return $element.injector().get(reference); }
            function blueprintService() { return injectorGet('blueprintService'); }

            let entity = blueprintService().get();
            let config = controller.saveToCatalogConfig;

            // Reset the config values if this is not an update
            if (!$scope.isUpdate) {
                config = {
                    itemType: 'entity',
                };
            }

            // Set various properties from the blueprint entity data
            if (!config.version && entity.hasVersion()) {
                config.version = entity.version;
            }
            if (!config.iconUrl && entity.hasIcon()) {
                config.iconUrl = entity.icon;
            }
            if (!config.name && entity.hasName()) {
                config.name = entity.name;
            }
            if (!config.symbolicName && entity.hasId()) {
                config.symbolicName = entity.id;
            }
            if (!config.bundle) {
                let bundle = config.symbolicName || config.name;
                bundle = bundle.split(/[^-a-zA-Z0-9.,_]+/).join('-').toLowerCase();
                config.bundle = bundle;
                if (!config.symbolicName) {
                    config.symbolicName = bundle;
                }
            }

            // Override this callback to update configuration data elsewhere
            (composerOverrides.updateCatalogConfig || ((config, $element, controller) => { }))(config, $element, controller);

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
                        $scope.isUpdate = true;
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
