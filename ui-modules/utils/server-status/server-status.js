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
import './server-status.less';

import angular from 'angular';
import uibModal from 'angular-ui-bootstrap/src/modal/index-nocss';
import modalTemplate from './server-status.template.html';
import {setSensitiveFields} from "../sensitive-field/sensitive-field";

const MODULE_NAME = 'br.utils.server-status';
const COOKIE_KEY = "br-server-status";
const COOKIE_EXPIRY = 15 * 60000;
const REFRESH_INTERVAL = 15000;
const DEFAULT_COOKIE = {dismissed: false};

angular.module(MODULE_NAME, [uibModal])
    .directive('brServerStatus', BrServerStatusDirective);

export default MODULE_NAME;

const LOGIN_PAGE_HEADER = "X_BROOKLYN_LOGIN_PAGE";

export function BrServerStatusDirective() {
    return {
        restrict: 'A',
        controller: ['$rootScope', '$scope', '$http', '$cookies', '$interval', '$uibModal', '$log', '$window', controller]
    };

    function controller($rootScope, $scope, $http, $cookies, $interval, $uibModal, $log, $window) {
        let cookie = DEFAULT_COOKIE;
        let intervalId = $interval(checkStatus, REFRESH_INTERVAL);
        $scope.$on('$destroy', () => ($interval.cancel(intervalId)));
        let modalInstance = null;
        var previousState = null;

        function checkStatus() {
            cookie = $cookies.getObject(COOKIE_KEY) || DEFAULT_COOKIE;
            $http({method: 'GET', url: '/v1/server/up/extended'})
                .then(updateState, (error) => (updateState(error, true)));
        }

        function updateState(response, error = false) {
            let state = BrServerStatusModalController.STATES.OK;
            let stateData = null;
            if (error) {
                stateData = response.data;

                if (stateData && stateData.SESSION_AGE_EXCEEDED) {
                    state = BrServerStatusModalController.STATES.SESSION_AGE_EXCEEDED;
                } else if (stateData && stateData.SESSION_INVALIDATED) {
                    state = BrServerStatusModalController.STATES.SESSION_INVALIDATED;
                }else if(response.status === 404) {
                    state = BrServerStatusModalController.STATES.NO_CONNECTION;
                }else if(response.status === 401 || response.status === 403 ) {
                    if( response.headers(LOGIN_PAGE_HEADER)) {
                        $window.location.href = '/' + response.headers(LOGIN_PAGE_HEADER);
                    }
                    state = BrServerStatusModalController.STATES.USER_NOT_AUTHORIZED;
                }else {
                    if (previousState === null || previousState == BrServerStatusModalController.STATES.OK){
                        state = BrServerStatusModalController.STATES.OTHER_ERROR;
                    } else {
                        // we're now getting a new server error, possibly because the old error has expired
                        // but changing the message for the user would be confusing so don't do that!
                        // eg we get a 405 after a 307 (which the browser handles automatically) if redirected to Google for login
                        $log.info("Server responded \"" + stateData + "\" after previous problem \"" + previousState + "\"");
                        // no update
                        state = previousState;
                    }
                }
                stateData = response;
            } else {
                stateData = response.data;
                if (stateData.shuttingDown) {
                    state = BrServerStatusModalController.STATES.STOPPING;
                } else if (!stateData.up) {
                    state = BrServerStatusModalController.STATES.STARTING;
                } else if (stateData.healthy && stateData.ha.planeId && stateData.ha.masterId !== stateData.ha.ownId) {
                    state = BrServerStatusModalController.STATES.NOT_HA_MASTER;
                } else if (!stateData.healthy) {
                    state = BrServerStatusModalController.STATES.UNHEALTHY;
                }

                let sensitiveFields = stateData['brooklyn.security.sensitive.fields'];
                if (sensitiveFields) {
                    setSensitiveFields(sensitiveFields.tokens, sensitiveFields['plaintext.blocked']);
                }
            }
            previousState = state;
            $rootScope.$broadcast('br-server-state-update', {state: state, stateData: stateData});
            if (state !== BrServerStatusModalController.STATES.OK && !cookie.dismissed && cookie.dismissedSate !== state) {
                openModal(state, stateData);
            }
        }

        function openModal(state, stateData) {
            if (!modalInstance) {
                modalInstance = $uibModal.open({
                    animation: true,
                    template: modalTemplate,
                    backdropClass: 'server-status-index',
                    windowClass: 'server-status-index',
                    controller: BrServerStatusModalController,
                    controllerAs: 'vm',
                    size: 'md',
                    resolve: {
                        state: () => (state),
                        stateData: () => (stateData)
                    }
                });
                modalInstance.result.then((reason) => {
                    if (reason === 'understood') {
                        cookie.dismissed = true;
                        cookie.dismissedSate = state;
                        $cookies.putObject(COOKIE_KEY, cookie, {expires: getCookieExpiryDate()});
                    }
                }, () => (modalInstance = null));
            }
        }

        function getCookieExpiryDate() {
            return new Date(Date.now() + COOKIE_EXPIRY);
        }

        checkStatus();


        class BrServerStatusModalController {
            static STATES = {
                OK: 'OK',
                STARTING: 'STARTING',
                STOPPING: 'STOPPING',
                NOT_HA_MASTER: 'NOT-HA-MASTER',
                NO_CONNECTION: 'NO-CONNECTION',
                UNHEALTHY: 'UNHEALTHY',
                SESSION_INVALIDATED: 'SESSION_INVALIDATED',
                SESSION_AGE_EXCEEDED: 'SESSION_AGE_EXCEEDED',
                OTHER_ERROR: 'OTHER_ERROR',
                USER_NOT_AUTHORIZED: 'USER_NOT_AUTHORIZED'
            };
            static $inject = ['$scope', '$uibModalInstance', 'state', 'stateData'];

            constructor($scope, $uibModalInstance, state, stateData) {
                this.$uibModalInstance = $uibModalInstance;
                this.state = state;
                this.stateData = stateData;
                $scope.$on('br-server-state-update', (event, value) => {
                    this.state = value.state;
                    this.stateData = value.stateData;
                });
            }

            close(reason = 'understood') {
                this.$uibModalInstance.close(reason);
            }

            get masterUri() {
                if (this.stateData.ha.nodes.hasOwnProperty(this.stateData.ha.masterId)) {
                    return this.stateData.ha.nodes[this.stateData.ha.masterId].nodeUri;
                } else {
                    return null;
                }
            }

            get nodes() {
                let currentNodeId = this.stateData.ha.ownId;
                let masterNode = null;
                let result = [];
                for (let nodeId in this.stateData.ha.nodes) {
                    let currentNode = this.stateData.ha.nodes[nodeId];
                    if (currentNode.nodeId === this.stateData.ha.masterId) {
                        masterNode = currentNode;
                    }
                    result.push(currentNode);
                }
                return result.reduce((pre, node) => {
                    node.state = ((node.localTimestamp + 30 * 1000) < masterNode.localTimestamp) ? 'offline' : 'online';
                    node.isMasterNode = node.nodeId === masterNode.nodeId;
                    node.isCurrentNode = node.nodeId === currentNodeId;
                    pre.push(node);
                    return pre;
                }, []);
            }
        }
    }
}
