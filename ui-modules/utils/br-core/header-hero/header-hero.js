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
import template from './header-hero.html';

const MODULE_NAME = 'core.header-hero';

/**
 * @ngdoc directive
 * @name brHeaderHero
 * @module brCore
 * @scope
 * @restrict E
 *
 * @description
 * HTML block element that displays a hero header composed of a Brooklyn image in a background and customisable
 * {@link #title} and text in a foreground.
 *
 * @param {string=} title Title of the hero header block.
 * @param {string=} text Text under the title.
 * @param {string=} cssClasses Extra css class(es) to add to the header hero container.

 *
 * @example
 * ### Hero header with no text.
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-header-hero />
 *     </file>
 * </example>
 *
 * @example
 * ### Hero header with only headline.
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-header-hero title="My application" />
 *     </file>
 * </example>
 *
 * @example
 * ### Hero header with headline and text.
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-header-hero title="My application" text="The text that complements the web app" />
 *     </file>
 * </example>
 *
 * @example
 * ### Hero header with a navbar and logo.
 * *Note that the directive will automatically use the white version of the logo*
 * <example module="br.core">
 *     <file name="index.html">
 *         <br-header-hero title="My application" text="The text that complements the web app">
 *             <br-navbar title="Acme Co" link="http://www.acme.com" logo="path/to/acme-logo.png">
 *                 <br-navbar-links-main>
 *                     <br-navbar-link-item link="#products">Products</br-navbar-link-item>
 *                     <br-navbar-link-item link="#testimonials">Testimonials</br-navbar-link-item>
 *                     <br-navbar-link-item link="#contact">Contact</br-navbar-link-item>
 *                  </br-navbar-links-main>
 *              </br-navbar>
 *          </br-header-hero>
 *     </file>
 * </example>
 *
 */
angular.module(MODULE_NAME, [angularBootstrap])
    .directive('brHeaderHero', brHeaderHero);

export default MODULE_NAME;

export function brHeaderHero() {
    return {
        restrict: 'E',
        scope: {
            title: '@',
            text: '@',
            headerStyle: '<',
            cssClasses: '@'
        },
        transclude: true,
        template: template,
        replace: true
    };
}
