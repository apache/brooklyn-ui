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
    deploy: 1,
    continue: 2,
};
const VIEWS = {
    form: 0,
    saved: 1
};
const TYPES = [
    {id: 'template', label: 'Application'},
    {id: 'entity', label: 'Entity'}
];

// only alphanumerics and/or '.', '-', '_' characters
const VALID_FIELD_PATTERN = /^[\w\.\-\_]+$/;

angular.module(MODULE_NAME, [angularAnimate, uibModal, brUtils])
    .directive('catalogSaver', ['$rootScope', '$uibModal', '$injector', '$filter', 'composerOverrides', 'blueprintService', saveToCatalogModalDirective])
    .directive('catalogVersion', ['$parse', catalogVersionDirective])
    .directive('composerBlueprintNameValidator', composerBlueprintNameValidatorDirective)
    .filter('bundlize', bundlizeProvider)
    .run(['$templateCache', templateCache]);

export default MODULE_NAME;

export function saveToCatalogModalDirective($rootScope, $uibModal, $injector, $filter, composerOverrides, blueprintService) {
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

    /*
     * Categories of data stored in 'config':
     *
     * original: what the catalog has
     * default: what should be shown as a placeholder if blank
     * initial: what current should be initalized as (not to show a placeholder)
     *
     * local.default: as above, but locally computed (not remembered)
     * current: what is being edited (ng model)
     *
     * Subfields:
     * {name,descriptiopn,version,bundle,symbolicName,itemType,iconUrl}
     *
     * Of the above, `local` and `current` are cleared each time the modal runs.
     * If the modal saves, then `initial` is replaced with the value of `current` so it is available next time.
     */

    // TODO We might need to refactor the controller and directive around this to structure it better
    function updateBundleConfig(entity, metadata, config) {
        // the name or can be inherited if root node is a known application type we are editing
        // (normally in those cases $scope.config will already be set by caller, but maybe not always)

        config.current.name = config.current.name || config.initial.name || config.local.default.name || entity.name

        // if user clears the current name, the placeholder could show the default or entity name
        // (rather than the last saved name); BUT this is subtle, maybe too much so;
        // also we don't support default values on name in the UI, nor in bundlizing, so actually better
        // not to set this
        // config.local.default.name = config.local.default.name || entity.name || config.original.name;

        config.current.version = config.initial.version || config.local.default.version || entity.version || metadata.get('version');

        // we do NOT set symbolic name from any entity metadata anymore; that ID is mostly used _internally_ eg might be 'root',
        // so it is not necessarily an appropriate symbolic name for the item in the bundle.
        //
        // if we DID want to do this then we would need to change bundlize to have the same logic
        // (or put this logic there instead)
        //
        // normally it make it a little bit simpler we just set the _current_ for symbolicName and bundle,
        // or we allow it to use bundlize to infer from the name
    }

    function initOurConfig($scope) {
        $scope.config.original = $scope.config.original || {}
        $scope.config.initial = $scope.config.initial || {}
        $scope.config.default = $scope.config.default || {}
        $scope.config.current = {};
        $scope.config.local = { default: {} };

        Object.assign($scope.config.local.default, $scope.config.default);
        Object.assign($scope.config.current, $scope.config.initial);

        $scope.isNewFromTemplate = () => ($scope.config.initial.itemType !== 'template' && $scope.config.original.itemType === 'template');
        $scope.isUpdate = () => !$scope.isNewFromTemplate() && Object.keys($scope.config.original).length>0 && $scope.config.initial.bundle === $scope.config.original.bundle;
        $scope.buttonTextFn = () => {
            const name = $scope.config.label || ($scope.isUpdate() && ($scope.config.initial.name || $scope.config.original.name || $scope.config.initial.symbolicName || $scope.config.original.symbolicName));
            return !!name ? 'Update ' + name : 'Add to catalog';
        }
        $scope.buttonText = $scope.buttonTextFn();
    }

    function link($scope, $element) {
        initOurConfig($scope);

        $scope.activateModal = () => {
            let entity = blueprintService.get();
            let metadata = blueprintService.entityHasMetadata(entity) ? blueprintService.getEntityMetadata(entity) : new Map();

            initOurConfig($scope);

            if (!$scope.config.current.itemType) {
                // This is the default item type
                $scope.config.current.itemType = $scope.config.local.default.itemType || 'application';
            }

            // Set various properties from the blueprint entity data if not already set
            if (!$scope.config.current.iconUrl && ($scope.config.initial.iconUrl || entity.hasIcon() || metadata.has('iconUrl'))) {
                $scope.config.current.iconUrl = $scope.config.initial.iconUrl || entity.icon || metadata.get('iconUrl');
            }
            if (!$scope.isNewFromTemplate()) {
                // (these should only be set if not making something new from a template, as the entity items will refer to the template)
                (composerOverrides.updateBundleConfig || updateBundleConfig)(entity,metadata, $scope.config);
            }

            // Override this callback to update configuration data elsewhere
            $scope.config = (composerOverrides.updateCatalogConfig || ((config, $element) => config))($scope.config, $element);

            const { bundle, symbolicName } = ($scope.config.initial || {});

            // Show advanced tab initially if bundle or symbolic name does not match the naming pattern.
            $scope.showAdvanced = (bundle && symbolicName)
                ? !VALID_FIELD_PATTERN.test(bundle) || !VALID_FIELD_PATTERN.test(symbolicName)
                : false;

            let modalInstance = $uibModal.open({
                templateUrl: TEMPLATE_MODAL_URL,
                size: 'save',
                controller: ['$scope', '$filter', 'blueprintService', 'paletteApi', 'brUtilsGeneral', CatalogItemModalController],
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
                    case REASONS.continue:
                        $rootScope.$broadcast('blueprint.continue');
                        break;
                }
            });
        };
    }
}

export function CatalogItemModalController($scope, $filter, blueprintService, paletteApi, brUtilsGeneral) {
    $scope.REASONS = REASONS;
    $scope.VIEWS = VIEWS;
    $scope.TYPES = TYPES;
    $scope.state = {
        pattern: VALID_FIELD_PATTERN,
        view: VIEWS.form,
        saving: false,
        force: false
    };
    /* Derived properties & calculators, will be updated whenever $scope.state.view changes */
    $scope.getTitle = () => {
        // expect we should always have current or default name, possibly don't need symbolicName or `blueprint` defaults
        const name = $scope.config.current.name || $scope.config.local.default.name || $scope.config.current.symbolicName || $scope.config.local.default.symbolicName;
        switch ($scope.state.view) {
            case VIEWS.form:
                return $scope.isUpdate() ? `Update ${name || 'blueprint'}` : 'Add to catalog';
            case VIEWS.saved:
                return `${name || 'Blueprint'} ${$scope.isUpdate() ? 'updated' : 'saved'}`;
        }
    };

    $scope.getCatalogURL = () => {
        const urlPartVersion = _.get($scope, 'config.current.version') || _.get($scope, 'config.version');
        if (!urlPartVersion) return "";

        switch ($scope.state.view) {
            case VIEWS.form:
                return '';
            case VIEWS.saved:
                // TODO where do these come from
                return `/brooklyn-ui-catalog/#!/bundles/${$scope.config.catalogBundleId}/${urlPartVersion}/types/${$scope.config.catalogBundleSymbolicName}/${urlPartVersion}`;
        }
    };

    $scope.title = $scope.getTitle();
    $scope.catalogURL = $scope.getCatalogURL();
    $scope.catalogBomPrefix = 'catalog-bom-';

    $scope.$watch('state.view', (newValue, oldValue) => {
        if (newValue !== oldValue) {
            $scope.title = $scope.getTitle();
            $scope.catalogURL = $scope.getCatalogURL();
        }
    });
    /* END Derived properties */

    const allTypes = [];
    const allBundles = [];

    // Prepare resources for analysis if this is not an Update request.
    if (!$scope.isUpdate()) {

        // Get all types and bundles for analysis.
        const promiseTypes = paletteApi.getTypes({params: {versions: 'all'}}).then(data => {
            allTypes.push(...data);
        }).catch(error => {
            $scope.state.error = error;
        });

        const promiseBundles = paletteApi.getBundles({params: {versions: 'all', detail: true}}).then(data => {
            allBundles.push(...data);
        }).catch(error => {
            $scope.state.error = error;
        });

        function checkIfBundleExists() {
            const bundleName = getBundleId();
            if (allBundles.find(item => item.symbolicName === bundleName)) {
                $scope.showAdvanced = true;
                $scope.state.warning = `Bundle with name "${bundleName}" exists already.`;
            } else {
                $scope.state.warning = undefined;
            }
        }

        Promise.all([promiseTypes, promiseBundles]).then(() => {
            console.info(`Loaded ${allBundles.length} bundles and ${allTypes.length} types for analysis.`)

            // Trigger an initial bundle name check.
            checkIfBundleExists();
        });

        // Watch for bundle name and display warning if bundle exists already.
        $scope.$watchGroup(['config.current.bundle', 'config.local.default.bundle'], () => {
            checkIfBundleExists();
        });
    }

    $scope.save = () => {
        $scope.state.saving = true;
        $scope.state.error = undefined;

        // Analyse existing catalog bundles if this is not an Update request.
        if (!$scope.isUpdate()) {

            const thisBundle = getBundleId();
            const bundles = [];
            const uniqueBundlesIds = new Set();

            // Check if type exists in other bundles.
            bundles.push(...allTypes.filter(item => item.symbolicName === getSymbolicName()).map(item => item.containingBundle));
            bundles.forEach(item => uniqueBundlesIds.add(item.split(':')[0]));

            if (uniqueBundlesIds.size > 0 && !uniqueBundlesIds.has(thisBundle)) {
                $scope.state.error = `This type cannot be saved in bundle "${thisBundle}" from the composer because ` +
                    `it would conflict with a type with the same ID "${getSymbolicName()}" in ${bundles.map(item => `"${item}"`).join(', ')}.`;
                $scope.showAdvanced = true;
                $scope.state.saving = false;
                return; // DO NOT SAVE!
            }

            // Check if any of existing bundles include other types.
            if (uniqueBundlesIds.size) {

                const bundlesWithMultipleTypes = bundles.filter(bundle => {
                    const [bundleName, bundleVersion] = bundle.split(':');
                    if (bundleName !== thisBundle) {
                        return false;
                    }
                    const existingBundle = allBundles.find(item => item.symbolicName === bundleName && item.version === bundleVersion);
                    const otherTypes = existingBundle.types.filter(item => item.symbolicName !== getSymbolicName())
                    return otherTypes.length > 0;
                });

                if (!$scope.state.error && bundlesWithMultipleTypes.length) {
                    $scope.state.error = `This type cannot be saved in bundle "${thisBundle}" from the composer because ` +
                        `${bundlesWithMultipleTypes.map(item => `"${item}"`).join(', ')} include${bundlesWithMultipleTypes.length > 1 ? '' : 's'} other types.`;
                    $scope.showAdvanced = true;
                    $scope.state.saving = false;
                    return; // DO NOT SAVE!
                }
            }
        }

        // Now, try to save.
        let bom = createBom();
        $scope.config.initial = $scope.config.current;
        paletteApi.create(bom, {forceUpdate: $scope.state.force})
            .then((savedItem) => {
                if (!angular.isArray($scope.config.versions)) {
                    $scope.config.versions = [];
                }
                $scope.config.versions.push($scope.config.current.version);
                $scope.state.view = VIEWS.saved;
            })
            .catch(error => {
                $scope.state.error = error.error.message;
            })
            .finally(() => {
                $scope.state.saving = false;
            });
    };

    function getBundleBase() {
        return $scope.config.current.bundle || $scope.config.local.default.bundle;
    }

    function getBundleId() {
        return getBundleBase() && $scope.catalogBomPrefix + getBundleBase();
    }

    function getSymbolicName() {
        return $scope.config.current.symbolicName || $scope.config.local.default.symbolicName;
    }

    function createBom() {
        let blueprint = blueprintService.getAsJson();

        const bundleBase = getBundleBase();
        const bundleSymbolicName = getSymbolicName();
        if (!bundleBase || !bundleSymbolicName) {
            throw "Either the display name must be set, or the bundle and symbolic name must be explicitly set";
        }

        let bomItem = {
            id: bundleSymbolicName,
            itemType: $scope.config.current.itemType,
            item: blueprint
        };
        // tags can now be added to a blueprint created in the YAML Editor
        let tags = [];
        if (blueprint.tags) {
            tags = tags.concat(blueprint.tags);
            delete blueprint['tags'];
        }
        if (blueprint['brooklyn.tags']) {
            tags = [].concat(blueprint['brooklyn.tags']).concat(tags);
        }
        blueprint['brooklyn.tags'] = tags;
        const bundleId = getBundleId();
        let bomCatalogYaml = {
            bundle: bundleId,
            version: $scope.config.current.version,
            items: [ bomItem ]
        };
        if(tags) {
            bomCatalogYaml.tags = tags
        }

        let bundleName = $scope.config.current.name || $scope.config.local.default.name;
        if (brUtilsGeneral.isNonEmpty(bundleName)) {
            bomItem.name = bundleName;
        }
        if (brUtilsGeneral.isNonEmpty($scope.config.current.description)) {
            bomItem.description = $scope.config.current.description;
        }
        if (brUtilsGeneral.isNonEmpty($scope.config.current.iconUrl)) {
            bomItem.iconUrl = $scope.config.current.iconUrl;
        }
        $scope.config.catalogBundleId = bundleId;
        $scope.config.catalogBundleSymbolicName = bundleSymbolicName;
        return jsYaml.dump({ 'brooklyn.catalog': bomCatalogYaml });
    }

    let bundlize = $filter('bundlize');
    $scope.updateDefaults = (newName) => {
        if (!newName) newName = $scope.config.local.default.name;
        $scope.config.local.default.symbolicName = $scope.config.default.symbolicName || ($scope.config.current.itemType==='template' && $scope.config.original.symbolicName) || bundlize(newName) || null;
        $scope.config.local.default.bundle = $scope.config.default.bundle || ($scope.config.current.itemType==='template' && $scope.config.original.bundle) || bundlize(newName) || null;
    };
    $scope.$watchGroup(['config.current.name', 'config.current.itemType', 'config.current.bundle', 'config.current.symbolicName'], (newVals) => {
        $scope.updateDefaults(newVals[0]);
        $scope.form.name.$validate();
        $scope.buttonText = $scope.buttonTextFn();
    });
}

function composerBlueprintNameValidatorDirective() {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, element, attr, ngModel) {
            ngModel.$validators.composerBlueprintNameValidator = function(modelValue, viewValue) {
                scope.updateDefaults(modelValue);
                if (!ngModel.$isEmpty(modelValue)) {
                    // anything set is valid
                    return true;
                }
                // if not set, we need a bundle and symbolic name
                if (scope.config.current.bundle && scope.config.current.symbolicName) {
                    return true;
                }
                // or if we have defaults for bundle and symbolic name we don't need this name
                if (scope.config.local.default.bundle && scope.config.local.default.symbolicName) {
                    return true;
                }
                return false;
            }
        },
    };
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
    }
}

function templateCache($templateCache) {
    $templateCache.put(TEMPLATE_URL, template);
    $templateCache.put(TEMPLATE_MODAL_URL, modalTemplate);
}

function bundlizeProvider() {
    return (input) => input && input.split(/[^a-zA-Z0-9]+/).filter(x => x).join('-').toLowerCase();
}
