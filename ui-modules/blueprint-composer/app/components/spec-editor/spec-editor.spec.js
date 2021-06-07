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

import SpecEditor, {SUBSECTION_TEMPLATE_URL} from './spec-editor.directive';
import {iconGeneratorProvider} from 'brooklyn-ui-utils/icon-generator/icon-generator';
import {locationApiProvider} from 'brooklyn-ui-utils/providers/location-api.provider';
import {catalogApiProvider} from 'brooklyn-ui-utils/providers/catalog-api.provider';
import {mdHelperFactory} from 'brooklyn-ui-utils/md-helper';
import {Entity} from '../util/model/entity.model';
import {paletteApiProvider} from '../providers/palette-api.provider';
import {dslServiceProvider} from '../providers/dsl-service.provider';
import {blueprintServiceProvider} from '../providers/blueprint-service.provider';

/**
 * Tests for the spec-editor directive.
 */
describe('Spec Editor', () => {

    /** The template compiler of the spec-editor */
    let $compile;

    /** The root scope of the spec-editor (the parent scope). */
    let $rootScope;

    /** The template cache of the spec-editor. */
    let $templateCache;

    /** The compiled element of the spec-editor. */
    let element;

    // Prepare dependencies for the spec-editor.
    beforeEach(angular.mock.module(($provide) => {

        // Dependencies of the blueprint service.
        $provide.provider('catalogApi', catalogApiProvider);
        $provide.provider('locationApi', locationApiProvider);
        $provide.provider('paletteApi', paletteApiProvider);
        $provide.provider('iconGenerator', iconGeneratorProvider);
        $provide.provider('dslService', dslServiceProvider);
        $provide.provider('brBrandInfo', {$get: () => {}});

        // Dependencies of the spec-editor.
        $provide.provider('blueprintService', blueprintServiceProvider);
        $provide.provider('$state', {$get: () => {}}); // Produces 'undefined', not needed just now.
        $provide.provider('composerOverrides', {$get: () => {return {}}}); // Produces 'Object {}'.
        $provide.factory('mdHelper', mdHelperFactory);
    }));

    // Initialize the spec-editor.
    beforeEach(angular.mock.module(SpecEditor));

    // Create new instance of $injector to resolve references.
    beforeEach(angular.mock.inject(function(_$compile_, _$rootScope_, _$templateCache_){
        $compile = _$compile_;
        $rootScope = _$rootScope_;
        $templateCache = _$templateCache_;

        // Compile a piece of HTML containing the directive
        $rootScope.testModel = new Entity();
        element = $compile('<spec-editor model="testModel"></spec-editor>')($rootScope);
        $rootScope.$digest();
    }));

    it('Creates controller of the directive', () => {
        let specEditor = element.controller('spec-editor');
        expect(specEditor).toBeDefined();
    });

    it('Creates default subsections', () => {
        let accordions = element.find('br-collapsible');

        // Expect 6 accordions, with the heading in the following order.
        expect(accordions.length).toBe(6);
        expect(accordions.eq(0).find('heading').text().trim()).toBe('Description');
        expect(accordions.eq(1).find('heading').text().trim()).toBe('Parameters');
        expect(accordions.eq(2).find('heading').text().trim()).toBe('Configuration');
        expect(accordions.eq(3).find('heading').text().trim()).toBe('Location');
        expect(accordions.eq(4).find('heading').text().trim()).toBe('Policies');
        expect(accordions.eq(5).find('heading').text().trim()).toBe('Enrichers');
    });

    it('Creates custom subsections', () => {

        // Prepare templates for custom accordions.
        $templateCache.put(SUBSECTION_TEMPLATE_URL.REQUIREMENTS, '<br-collapsible><heading>Requirements</heading></br-collapsible>');
        $templateCache.put(SUBSECTION_TEMPLATE_URL.OTHERS, '<br-collapsible><heading>Other</heading></br-collapsible>');
        $templateCache.put('dummy-template.html', '<br-collapsible><heading>Dummy</heading></br-collapsible>');
        element = $compile('<spec-editor model="testModel"></spec-editor>')($rootScope);
        $rootScope.$digest();

        let accordions = element.find('br-collapsible');

        // Expect 8 accordions, with the heading in the following order.
        expect(accordions.length).toBe(8);
        expect(accordions.eq(0).find('heading').text().trim()).toBe('Description');
        expect(accordions.eq(1).find('heading').text().trim()).toBe('Parameters');
        expect(accordions.eq(2).find('heading').text().trim()).toBe('Configuration');
        expect(accordions.eq(3).find('heading').text().trim()).toBe('Requirements'); // Supplied template for requirements
        expect(accordions.eq(4).find('heading').text().trim()).toBe('Location');
        expect(accordions.eq(5).find('heading').text().trim()).toBe('Policies');
        expect(accordions.eq(6).find('heading').text().trim()).toBe('Enrichers');
        expect(accordions.eq(7).find('heading').text().trim()).toBe('Other'); // Supplied template for other section
        // No other templates injected, e.g. dummy.
    });
});
