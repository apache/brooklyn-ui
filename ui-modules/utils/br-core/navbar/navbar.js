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
import navbarTemplate from './navbar.html';
import navbarLinkDropdownTemplate from './navbar-links-dropdown.html';
import navbarLinkMainTemplate from './navbar-links-main.html';
import navbarLinkSecondaryTemplate from './navbar-links-secondary.html';
import linkItemTemplate from './link-item.html';

const MODULE_NAME = 'core.navbar';

/**
 * @ngdoc directive
 * @name brNavbar
 * @module brCore
 * @scope
 * @restrict E
 *
 * @description
 * HTML block element that displays the main navigation bar at the top of the page.
 *
 * @param {string=} title The app/website title. Will be displayed on the left of the navbar.
 * @param {string=} logo The logo URL. Will be displayed on the left of the navbar, before the {@link #title} if exists.
 * @param {string=} link The URL to target upon a click on the {@link #title}/{@link #logo}.
 * @param {boolean=} fixedOnTop Mark the navbar as "fixed" on top.
 * @param {string=} cssClasses Extra css class(es) to add to the global navbar container.
 *
 * @example
 * ### Basic navbar
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-navbar title="Acme" link="http://www.acme.com" logo="path/to/logo.png"></br-navbar>
 *     </file>
 * </example>
 *
 * @example
 * ### Navbar with main navigation links
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-navbar title="Acme">
 *             <br-navbar-links-main>
 *                 <br-navbar-link-item link="#products">Products</br-navbar-link-item>
 *                 <br-navbar-link-item link="#testimonials">Testimonials</br-navbar-link-item>
 *                 <br-navbar-link-item link="#contact">Contact</br-navbar-link-item>
 *             </br-navbar-links-main>
 *         </br-navbar>
 *     </file>
 * </example>
 *
 * @example
 * ### Navbar with secondary navigation links
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-navbar title="Acme">
 *             <br-navbar-links-secondary>
 *                 <br-navbar-link-item link="http://github.com/apache" icon="fa-github"></br-navbar-link-item>
 *                 <br-navbar-link-item link="http://twitter.com/apache" icon="fa-twitter"></br-navbar-link-item>
 *             </br-navbar-links-secondary>
 *         </br-navbar>
 *     </file>
 * </example>
 *
 * @example
 * ### Navbar with dropdown navigation links
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-navbar title="Acme Corp">
 *             <br-navbar-links-main>
 *                 <br-navbar-link-item link="#products">Products</br-navbar-link-item>
 *                 <br-navbar-link-item link="#testimonials">Testimonials</br-navbar-link-item>
 *                 <br-navbar-link-item link="#contact">Contact</br-navbar-link-item>
 *                 <br-navbar-links-dropdown label="Links">
 *                     <br-navbar-link-item link="http://github.com/apache">GitHub</br-navbar-link-item>
 *                     <br-navbar-link-item link="http://twitter.com/apache">Twitter</br-navbar-link-item>
 *                 </br-navbar-links-dropdown>
 *             </br-navbar-links-main>
 *         </br-navbar>
 *     </file>
 * </example>
 *
 * @example
 * ### Navbar with angular loading bar
 * <example module="myNavbar">
 *     <file name="index.html">
 *         <div ng-controller="myController">
 *             <br-navbar title="Acme Corp">
 *                 <br-navbar-links-secondary>
 *                     <br-navbar-link-item ng-click="startLoading()">Start loading</br-navbar-link-item>
 *                     <br-navbar-link-item ng-click="completeLoading()">Complete loading</br-navbar-link-item>
 *                 </br-navbar-links-secondary>
 *             </br-navbar>
 *         </div>
 *     </file>
 *     <file name="app.js">
 *         angular.module('myNavbar', ['br.core'])
 *             .controller('myController', function($scope, cfpLoadingBar) {
 *                  $scope.startLoading = function() {
 *                      cfpLoadingBar.start();
 *                  };
 *                  $scope.completeLoading = function () {
 *                      cfpLoadingBar.complete();
 *                  };
 *             });
 *     </file>
 * </example>
 */
angular.module(MODULE_NAME, [angularBootstrap])
    .directive('brNavbar', brNavbar)
    .directive('brNavbarLinksMain', brNavbarLinksMain)
    .directive('brNavbarLinksSecondary', brNavbarLinksSecondary)
    .directive('brNavbarLinksDropdown', brNavbarLinksDropdown)
    .directive('brNavbarLinkItem', brNavbarLinkItem);

export default MODULE_NAME;

export function brNavbar() {
    return {
        restrict: 'E',
        scope: {
            title: '@',
            logo: '@',
            link: '@',
            fixedOnTop: '@',
            cssClasses: '@'
        },
        transclude: true,
        template: navbarTemplate,
        replace: true,
    };
}

export function brNavbarLinksMain() {
    return {
        require: '^brNavbar',
        restrict: 'E',
        transclude: true,
        template: navbarLinkMainTemplate,
        replace: true,
        controller: function() {}
    };
}

export function brNavbarLinksSecondary() {
    return {
        require: '^brNavbar',
        restrict: 'E',
        transclude: true,
        template: navbarLinkSecondaryTemplate,
        replace: true,
        controller: function() {}
    };
}

/**
 * @ngdoc directive
 * @name brNavbarLinksDropdown
 * @module brCore
 * @scope
 * @restrict E
 *
 * @description
 * HTML block element that displays a dropdown of {@link brNavbarLinkItem} within the {@link brNavbar}.
 *
 * @param {string} label The label of the dropdown.
 * @param {string=} cssClasses Extra css class(es) to add to the dropdown label.
 */
export function brNavbarLinksDropdown() {
    return {
        require: ['?^brNavbarLinksMain', '?^brNavbarLinksSecondary'],
        restrict: 'E',
        scope: {
            label: '@',
            cssClasses: '@'
        },
        transclude: true,
        template: navbarLinkDropdownTemplate,
        replace: true,
        controller: function() {},
        link: function(scope, element, attrs, controllers) {
            if (controllers[0] == null && controllers[1] == null) {
                throw new Error('brNavbarLinksDropdown directive must be used within brNavbarLinksMain or brNavbarLinksSecondary');
            }
        }
    };
}

/**
 * @ngdoc directive
 * @name brNavbarLinkItem
 * @module brCore
 * @scope
 * @restrict E
 *
 * @description
 * HTML block element that displays a link item within the {@link brNavbar}. The link can be composed can have a custom
 * icon coming from [font-awesome](https://fortawesome.github.io/Font-Awesome/icons/).
 *
 * @param {string} link The URL to target upon a click on the this item.
 * @param {string=} icon the font-awesome class name corresponding to the icon to display.
 * @param {string=} cssClasses Extra css class(es) to add to link.
 */
export function brNavbarLinkItem() {
    return {
        require: ['?^brNavbarLinksMain', '?^brNavbarLinksSecondary', '?^brNavbarLinksDropdown'],
        restrict: 'E',
        scope: {
            link: '@',
            icon: '@',
            cssClasses: '@'
        },
        transclude: true,
        template: linkItemTemplate,
        replace: true,
        link: function(scope, element, attrs, controllers) {
            if (controllers[0] == null && controllers[1] == null && controllers[2] == null) {
                throw new Error('brNavbarLinkItem directive must be used within brNavbarLinksMain, brNavbarLinksSecondary or brNavbarLinksDropdown');
            }
        }
    };
}
