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
import footerTemplate from './footer.html';
import footerBlockMainTemplate from './footer-block-main.html';
import footerBlockSecondaryTemplate from './footer-block-secondary.html';
import linkItemTemplate from './../navbar/link-item.html';

const MODULE_NAME = 'core.footer';

/**
 * @ngdoc directive
 * @name brFooter
 * @module brCore
 * @restrict E
 *
 * @description
 * HTML block element that displays the main footer at the bottom of the page. The footer can be composed of a main and
 * secondary zone for text + links.
 *
 * @example
 * ### Basic footer with text
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-footer>
 *             <br-footer-block-main>
 *                 <h2>My app</h2>
 *                 <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris rutrum eros bibendum lectus aliquam, nec tempus elit iaculis. Praesent iaculis magna non posuere auctor.</p>
 *             </br-footer-block-main>
 *         </br-footer>
 *     </file>
 * </example>
 *
 * @example
 * ### Footer with links
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-footer>
 *             <br-footer-block-secondary>
 *                 <br-footer-link-item link="http://github.com/apache" icon="fa-github"></br-footer-link-item>
 *                 <br-footer-link-item link="http://twitter.com/apache" icon="fa-twitter"></br-footer-link-item>
 *             </br-footer-block-secondary>
 *         </br-footer>
 *     </file>
 * </example>
 *
 * @example
 * ### Full footer
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-footer>
 *             <br-footer-block-main>
 *                 <br-footer-copyright app-name="My awesome app" />
 *             </br-footer-block-main>
 *             <br-footer-block-secondary title="Social links">
 *                 <br-footer-link-item link="http://github.com/apache" icon="fa-github"></br-footer-link-item>
 *                 <br-footer-link-item link="http://twitter.com/apache" icon="fa-twitter"></br-footer-link-item>
 *             </br-footer-block-secondary>
 *         </br-footer>
 *     </file>
 * </example>
 */
angular.module(MODULE_NAME, [angularBootstrap])
    .directive('brFooter', brFooter)
    .directive('brFooterBlockMain', brFooterBlockMain)
    .directive('brFooterBlockSecondary', brFooterBlockSecondary)
    .directive('brFooterLinkItem', brFooterLinkItem);

export default MODULE_NAME;

/**
 * @ngdoc directive
 * @name brFooter
 * @module brCore
 * @scope
 * @restrict E
 *
 * @description
 * HTML block element that displays a footer for the given {@link #appName}.
 *
 * @param {string=} appName Application name to licensed. Will be displayed within the license text.
 *
 * @example
 * ### Basic example
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-footer app-name="New great application" />
 *     </file>
 * </example>
 */
export function brFooter() {
    return {
        restrict: 'E',
        transclude: true,
        template: footerTemplate,
        replace: true
    };
}

export function brFooterBlockMain() {
    return {
        require: '^brFooter',
        restrict: 'E',
        transclude: true,
        template: footerBlockMainTemplate,
        replace: true,
        controller: function() {}
    };
}

export function brFooterBlockSecondary() {
    return {
        require: '^brFooter',
        restrict: 'E',
        scope: {
            title: '@'
        },
        transclude: true,
        template: footerBlockSecondaryTemplate,
        replace: true,
        controller: function() {}
    };
}

/**
 * @ngdoc directive
 * @name brFooterLinkItem
 * @module brCore
 * @restrict E
 *
 * @description
 * HTML block element that displays a link item within the {@link brFooter}. The link can be composed can have a custom
 * icon coming from [font-awesome](https://fortawesome.github.io/Font-Awesome/icons/).
 *
 * @param {string} link The URL to target upon a click on the this item.
 * @param {string=} icon the font-awesome class name corresponding to the icon to display.
 * @param {string=} cssClasses Extra css class(es) to add to the link.
 */
export function brFooterLinkItem() {
    return {
        require: '^brFooterBlockSecondary',
        restrict: 'E',
        scope: {
            link: '@',
            icon: '@',
            cssClasses: '@'
        },
        transclude: true,
        template: linkItemTemplate,
        replace: true
    };
}
