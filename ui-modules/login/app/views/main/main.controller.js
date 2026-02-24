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
import uiRouter from 'angular-ui-router';
import serverApi from 'brooklyn-ui-utils/api/brooklyn/server.js';
import {HIDE_INTERSTITIAL_SPINNER_EVENT} from 'brooklyn-ui-utils/interstitial-spinner/interstitial-spinner';
import template from "./main.template.html";
import modalTemplate from './login-failed.template.html';
import './login-failed.less';

const MODULE_NAME = 'states.login';

angular.module(MODULE_NAME, [uiRouter, serverApi])
    .config(['$stateProvider', loginStateConfig])
    .config(['$httpProvider', function($httpProvider) {
      // Sometimes this can help prevent the auth popup from appearing,
      // by indicating the apache and nginx that WWW-Authenticate should be omitted.
      // Not necessary because Brooklyn server rewrites BASIC where necessary, but potentially useful.
      $httpProvider.defaults.headers.common["X-Requested-With"] = 'XMLHttpRequest';
    }]);

export default MODULE_NAME;

export const loginState = {
    name: 'login',
    url: '/',
    template: template,
    controller: ['$scope', '$http', '$window', '$uibModal', 'brBrandInfo', loginStateController],
    controllerAs: 'vm',
    resolve: {}
};

export function loginStateConfig($stateProvider) {
    $stateProvider.state(loginState);
}

export function loginStateController($scope, $http, $window, $uibModal, brBrandInfo) {
    $scope.$emit(HIDE_INTERSTITIAL_SPINNER_EVENT);
    $scope.getBrandedText = brBrandInfo.getBrandedText;

    let modalInstance = null;
    let loginController = this;
    loginController.error = {};

    const testAuthReq = {
        method: 'HEAD',
        url: '/v1/server/up/extended',
        headers: {
          // as above (httpProvider)
          'X-Requested-With': 'XMLHttpRequest'
        }
    }

    // If the user is already logged in then redirect to home
    // (note httpProvider call above to prevent browser popup)
    $http(testAuthReq).then( () => {
        if ($window.location.pathname = '/') {
          throw new Error('Actually API request was successful, and we are logged in, but this page is configured to be shown as the root. A redirect will result in an infinite loop, so will ignore and simply show this form.');
          // will get caught below
        }
        console.debug("API request successful. Either already logged in or no login necessary. Redirecting to main page instead of showing login form. Coming from: "+$window.location.href);
        $window.location.href = '/';
      }).catch(err => {
        console.debug("API request unsuccessful. Not already logged in. Showing login form.", err);
      });

    $scope.login = (user)=> {
        if (user==null) {
            openModal();
            return;
        }
        var req = {
            ...testAuthReq,
            headers: {
                ...testAuthReq.headers,
                'Authorization': 'Basic ' + btoa(user.name +":" + user.password)
            }
        }
// ui registry metadata
        $http(req)
            .then(() => ( $window.location.href = '/' ))
            .catch(() => ( openModal() ));
    };


    function openModal() {
        if (!modalInstance) {
            modalInstance = $uibModal.open({
                animation: true,
                template: modalTemplate,
                backdropClass: 'login-failed-index',
                windowClass: 'login-failed-index',
                controller: brLoginFailedModalController,
                controllerAs: 'vm',
                size: 'md',
                resolve: {}
            });
            modalInstance.result
                .then((reason) => ( modalInstance = null ))
                .catch((reason) => ( modalInstance = null ));
        }
    }


    class brLoginFailedModalController {
        static $inject = ['$scope', '$uibModalInstance'];

        constructor($scope, $uibModalInstance) {
            this.$uibModalInstance = $uibModalInstance;
        }

        close(reason = 'OK') {
            this.$uibModalInstance.close(reason);
        }
    }
}
