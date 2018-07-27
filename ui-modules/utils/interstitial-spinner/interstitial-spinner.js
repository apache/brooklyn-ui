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

const MODULE_NAME = 'br.utils.interstitial-spinner';

angular.module(MODULE_NAME, [])
    .directive('brInterstitialSpinner', ['$rootScope', brInterstitialSpinner]);

export default MODULE_NAME;

export const HIDE_INTERSTITIAL_SPINNER_EVENT = 'hide-interstitial-spinner';

export function brInterstitialSpinner($rootScope) {
    return {
        restrict: 'E',
        scope: {
            eventCount: '@',
            maxWait: '@',
            removeAfter: '@'
        },
        link: link
    };

    function link($scope, $element) {
        let currentEventCount = 0;
        let eventCount = (angular.isDefined($scope.eventCount) ? parseInt($scope.eventCount, 10) : null);
        let maxWait = (angular.isDefined($scope.maxWait) ? parseInt($scope.maxWait, 10) : 15000);
        let removeAfter = (angular.isDefined($scope.removeAfter) ? parseInt($scope.removeAfter, 10) : 1000);

        if (eventCount) {
            $rootScope.$on(HIDE_INTERSTITIAL_SPINNER_EVENT, ()=> {
                currentEventCount++;
                if (currentEventCount >= eventCount) {
                    hideSpinner(removeAfter);
                }
            });
            setTimeout(()=>(hideSpinner(removeAfter)), maxWait);
            setTimeout(()=>($element.addClass('interstitial-slow-connection')), 5000);
        } else {
            hideSpinner(removeAfter);
        }

        function hideSpinner(delay = 1000) {
            $element.addClass('interstitial-hidden');
            setTimeout(()=>($element.remove()), delay);
        }
    }
}
