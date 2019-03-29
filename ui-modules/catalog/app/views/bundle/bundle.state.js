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
import template from './bundle.template.html';
import brooklynTypeItem from '../../components/type-item/index';
import {catalogState, bundleNameFilter, bundleDescriptionFilter, bundleHighlightsFilter, bundleTypeFilter} from '../catalog/catalog.state';
import brUtils from 'brooklyn-ui-utils/utils/general';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';

const MODULE_NAME = 'bundle.state';

angular.module(MODULE_NAME, [brUtils, brooklynTypeItem])
    .config(['$stateProvider', bundleStateConfig])
    .filter('bundleName', ['$sce', bundleNameFilter])
    .filter('bundleDescription', ['$sce', bundleDescriptionFilter])
    .filter('bundleHighlights', ['$sce', bundleHighlightsFilter])
    .filter('bundleTypeFilter', ['$sce', bundleTypeFilter]);

export default MODULE_NAME;

export const bundleState = {
    name: 'bundle',
    url: '/bundles/:bundleId/:bundleVersion',
    template: template,
    controller: ['$scope', '$state', '$stateParams', 'brSnackbar', 'brUtilsGeneral', 'catalogApi', bundleController],
    controllerAs: 'ctrl'
};

export function bundleStateConfig($stateProvider) {
    $stateProvider.state(bundleState);
}

export function bundleController($scope, $state, $stateParams, brSnackbar, brUtilsGeneral, catalogApi) {
    const orderBys = [{
        id: 'displayName',
        label: 'Name'
    }, {
        id: '-version',
        label: 'Version'
    }, {
        id: '-supertypes',
        label: 'Type'
    }];

    $scope.config = {
        orderBy: orderBys
    };

    $scope.state = {
        orderBy: orderBys[0],
        search: {}
    };

    $scope.clearSearchFilters = () => {
        $scope.state.search = {};
        $scope.state.orderBy = orderBys[0];
    };

    $scope.deleteBundle = () => {
        $scope.state.deleting = true;
        catalogApi.deleteBundle($scope.bundle.symbolicName, $scope.bundle.version).then(data => {
            $state.go(catalogState);
        }).catch(error => {
            let errorMessage= ('undefined' === typeof error.message)? error.error.message: error.message;
            brSnackbar.create('Could not delete this bundle: ' + errorMessage);
        }).finally(() => {
            $scope.state.deleting = false;
        });
    };

    $scope.isNonEmpty = (o) => {
        return brUtilsGeneral.isNonEmpty(o);
    };

    catalogApi.getBundle($stateParams.bundleId, $stateParams.bundleVersion).then(bundle => {
        bundle.types.forEach( (t) => {
            // tidy up display so that things labelled [DEPRECATED] don't have that ugly name
            // (since we highlight deprecated things, and particularly bad since [ appears first alphabetically!)
            if (t.deprecated && t.displayName.match(/^[^\w]*deprecated[^\w]*/i)) {
                t.displayName = t.displayName.replace(/^[^\w]*deprecated[^\w]*/i, '');
            }
        } );
        $scope.bundle = bundle;
        $scope.typeVersions = Array.from(new Set(bundle.types.map(type => type.version)));

        return catalogApi.getBundleVersions($stateParams.bundleId);
    }).then(bundleVersions => {
        $scope.bundleVersions = bundleVersions.map(bundleVersion => bundleVersion.version);
        $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    }).catch(error => {
        let errorMessage= ('undefined' === typeof error.message)? error.error.message: error.message;
        brSnackbar.create(`Could not load bundle ${$stateParams.bundleId}:${$stateParams.bundleVersion}: ${error.status === 404 ? 'Not found' : errorMessage}`);
        $state.go(catalogState);
    });
}
