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
import brBrandInfo from 'brand-js';
import button from './button/button';
import card from './card/card';
import collapsible from './collapsible/collapsible';
import svg from './br-svg/br-svg';
import footer from './footer/footer';
import headerHero from './header-hero/header-hero';
import list from './list/list';
import navbar from './navbar/navbar';
import snackbar from './snackbar/snackbar';

const MODULE_NAME = 'brooklyn.ui.core';
/**
 * @ngdoc module
 * @name brCore
 * @requires ui.bootstrap
 * @requires ngAnimate
 * @description
 */
angular.module(MODULE_NAME, [
    angularBootstrap,
    brBrandInfo,
    button,
    card,
    collapsible,
    svg,
    footer,
    headerHero,
    list,
    navbar,
    snackbar
]);

export default MODULE_NAME;
