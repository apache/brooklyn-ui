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
import template from './index.html';

import brIconGenerator from 'brooklyn-ui-utils/icon-generator/icon-generator';

const MODULE_NAME = 'brooklyn.components.type-item';

angular.module(MODULE_NAME, [brIconGenerator])
    .directive('typeItem', typeListDirective);

export default MODULE_NAME;

export function typeListDirective() {
    return {
        restrict: 'EA',
        scope: {
            type: '<',
            bundle: '<',
            showType: '<?',
            showBundle: '<?'
        },
        template: template
    };
}
