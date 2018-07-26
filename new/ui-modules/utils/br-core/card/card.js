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
import angularBootstrap from 'angular-ui-bootstrap';
import cardTemplate from './card.html';
import cardContentTemplate from './card-content.html';
import cardContentHeadlineTemplate from './card-content-headline.html';
import cardContentSubheadTemplate from './card-content-subhead.html';
import cardActionTemplate from './card-actions.html';

const MODULE_NAME = 'core.card';

/**
 * @ngdoc directive
 * @name brCard
 * @module brCore
 * @restrict E
 *
 * @description
 * HTML element use to display data as a card. There are few possibilities on how to use it, please see example.
 *
 * @param {boolean=} center Center card content.
 *
 * @example
 * ### Basic card with title and description
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-card>
 *             <br-card-content>
 *                 <br-card-content-headline>My title</br-card-content-headline>
 *                 <br-card-content-subhead>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus egestas metus in arcu interdum, vel rutrum felis ornare. Morbi eu purus sed libero viverra sollicitudin.</br-card-content-subhead>
 *             </br-card-content>
 *         </br-card>
 *     </file>
 * </example>
 *
 * @example
 * ### Basic card without title
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-card>
 *             <br-card-content>
 *                 <br-card-content-subhead>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus egestas metus in arcu interdum, vel rutrum felis ornare. Morbi eu purus sed libero viverra sollicitudin.</br-card-content-subhead>
 *             </br-card-content>
 *         </br-card>
 *     </file>
 * </example>
 *
 * @example
 * ### Basic card with action buttonssss
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-card>
 *             <br-card-content>
 *                 <br-card-content-headline>My title</br-card-content-headline>
 *                 <br-card-content-subhead>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus egestas metus in arcu interdum, vel rutrum felis ornare. Morbi eu purus sed libero viverra sollicitudin.</br-card-content-subhead>
 *             </br-card-content>
 *             <br-card-actions>
 *                 <br-button type="btn-default">Cancel</br-button>
 *                 <br-button type="btn-primary">Submit</br-button>
 *             </br-card-actions>
 *         </br-card>
 *     </file>
 * </example>
  *
 * @example
 * ### Basic card centered
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-card center="true">
 *             <br-card-content>
 *                 <br-card-content-headline>My title</br-card-content-headline>
 *                 <br-card-content-subhead>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus egestas metus in arcu interdum, vel rutrum felis ornare. Morbi eu purus sed libero viverra sollicitudin.</br-card-content-subhead>
 *             </br-card-content>
 *             <br-card-actions>
 *                 <br-button type="btn-default">Cancel</br-button>
 *                 <br-button type="btn-primary">Submit</br-button>
 *             </br-card-actions>
 *         </br-card>
 *     </file>
 * </example>
 */
angular.module(MODULE_NAME, [angularBootstrap])
    .directive('brCard', brCard)
    .directive('brCardContent', brCardContent)
    .directive('brCardContentHeadline', brCardContentHeadline)
    .directive('brCardContentSubhead', brCardContentSubhead)
    .directive('brCardActions', brCardActions);


export default MODULE_NAME;

export function brCard() {
    return {
        restrict: 'E',
        scope: {
            center: '@'
        },
        transclude: true,
        template: cardTemplate,
        replace: true
    };
}

export function brCardContent() {
    return {
        require: '^brCard',
        restrict: 'E',
        transclude: true,
        template: cardContentTemplate,
        replace: true
    };
}

export function brCardContentHeadline() {
    return {
        require: '^br-card-content',
        restrict: 'E',
        transclude: true,
        template: cardContentHeadlineTemplate,
        replace: true
    };
}

export function brCardContentSubhead() {
    return {
        require: '^brCardContent',
        restrict: 'E',
        transclude: true,
        template: cardContentSubheadTemplate,
        replace: true
    };
}

export function brCardActions() {
    return {
        require: '^brCard',
        restrict: 'E',
        transclude: true,
        template: cardActionTemplate,
        replace: true
    };
}
