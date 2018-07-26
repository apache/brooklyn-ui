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
import closeTemplate from './br-svg-close.html';

const MODULE_NAME = 'core.svg';

/**
 * @ngdoc directive
 * @name brSvg
 * @module brCore
 * @scope
 * @restrict AE
 *
 * @description
 * Block directive that loads SVG inline. Here is the list currently supported:
 * - `close`: Close cross. Used in the modal
 * If the svg ID does not exist, the directive will display nothing.
 *
 * @param {string=} type ID of the svg to use.
 *
 * @example
 * ### Loading an existing SVG, e.g close icon
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-svg type="close" style="width: 50px; height: 50px;"></br-svg>
 *     </file>
 * </example>
 *
 * @example
 * ### Loading an none existing SVG
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-svg type="doesnotexists"></br-svg>
 *     </file>
 * </example>
 */
angular.module(MODULE_NAME, [])
    .directive('brSvg', brSvg);

export default MODULE_NAME;

export function brSvg() {
    return {
        restrict: 'EA',
        template: function(tElement, tAttrs) {
            var svgs = {
                close: closeTemplate
            };

            return tAttrs.type && svgs.hasOwnProperty(tAttrs.type) ? svgs[tAttrs.type] : undefined;
        }
    };
}
