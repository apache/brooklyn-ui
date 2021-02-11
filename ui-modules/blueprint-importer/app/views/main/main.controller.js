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
import ngClipboard from 'ngclipboard';
import stackViewer from 'angular-java-stack-viewer';
import brYamlEditor from 'brooklyn-ui-utils/yaml-editor/yaml-editor';
import brBottomSheet from 'brooklyn-ui-utils/bottom-sheet/bottom-sheet';
import {catalogApiProvider} from 'brooklyn-ui-utils/providers/catalog-api.provider';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from "brooklyn-ui-utils/interstitial-spinner/interstitial-spinner";
import template from './main.template.html';
import bottomSheetTemplate from './bottom-sheet.template.html';

const MODULE_NAME = 'main.state';

angular.module(MODULE_NAME, [ngClipboard, stackViewer, brYamlEditor, brBottomSheet])
    .provider('catalogApi', catalogApiProvider)
    .config(['$stateProvider', mainStateConfig]);

export default MODULE_NAME;

export const mainState = {
    name: 'main',
    url: '/?yaml',
    params: {
        yaml: {value: ''}
    },
    template: template,
    controller: ['$scope', '$stateParams', 'brBottomSheet', mainController],
    controllerAs: 'ctrl'
};

export function mainStateConfig($stateProvider) {
    $stateProvider.state(mainState);
}

export function mainController ($scope, $stateParams, brBottomSheet) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);

    this.yaml = $stateParams.yaml;

    this.import = ()=> {
        let options = {
            controller: ['$log', 'brBrandInfo', 'brBottomSheetInstance', 'catalogApi', 'brSnackbar', 'yaml', bottomSheetController],
            controllerAs: 'ctrl',
            template: bottomSheetTemplate,
            resolve: {
                yaml: ()=>(this.yaml)
            }
        };
        brBottomSheet.open(options);
    };

}

function bottomSheetController($log, brBrandInfo, brBottomSheetInstance, catalogApi, brSnackbar, yaml) {
    this.loading = true;
    this.imported = false;
    this.vendors = brBrandInfo.getVendorPackages();

    this.close = ()=> {
        brBottomSheetInstance.close('User closed the bottom sheet');
    };
    this.investigate = ()=> {
        brBottomSheetInstance.updateMode('inset');
    };
    this.onClipboardSuccess = (e)=> {
        angular.element(e.trigger).triggerHandler('copied');
        e.clearSelection();
    };
    this.onClipboardError = (e)=> {
        let message = '';
        let actionKey = e.action === 'cut' ? 'X' : 'C';
        if(/iPhone|iPad/i.test(navigator.userAgent)) {
            message = 'No support :(';
        }
        else if(/Mac/i.test(navigator.userAgent)) {
            message = 'Press ⌘-' + actionKey + ' to ' + e.action;
        }
        else {
            message = 'Press Ctrl-' + actionKey + ' to ' + e.action;
        }
        brSnackbar.create(message);
    };

    this.getCatalogItemUrl = (item)=> {
        switch (item.itemType.toLowerCase()) {
            case 'template':
            case 'entity':
            case 'policy':
                let bundle = item.containingBundle.split(':');
                return `/brooklyn-ui-catalog/#!/bundles/${bundle[0]}/${bundle[1]}/types/${item.symbolicName}/${item.version}`;
            case 'location':
                return `/brooklyn-ui-location-manager/#!/location?symbolicName=${item.symbolicName}&version=${item.version}`;
            default:
                return;
        }
    };
    this.getDeployUrl = (item)=> {
        switch (item.itemType.toLowerCase()) {
            case 'template':
                let bundle = item.containingBundle.split(':');
                return `/#!/deploy/${bundle[0]}/${bundle[1]}/${item.symbolicName}/${item.version}`;
            case 'entity':
                let yaml = {
                    name: item.name,
                    services: [{
                        type: item.symbolicName + ':' + item.version
                    }]
                };
                return '/brooklyn-ui-blueprint-composer/#!/graphical?format=brooklyn-camp&yaml=' + JSON.stringify(yaml);
            default:
                return;
        }
    };
    this.canBeDeployed = (item)=> {
        return ['template', 'entity'].indexOf(item.itemType.toLowerCase()) > -1;
    };

    catalogApi.create(yaml).then((response)=> {
        $log.info('Blueprint import ... success ', response);
        this.imported = true;
        this.importedItems = response;
    }).catch((response)=> {
        $log.error('Blueprint import ... error ', response);
        this.error = {
            title: 'Blueprint import failed',
            message: response.error.message,
            details: response.error.details
        };
    }).finally(()=> {
        this.loading = false;
    });
}


