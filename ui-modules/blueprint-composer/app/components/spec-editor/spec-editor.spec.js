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

import SpecEditor, {SUBSECTION_TEMPLATE_OTHERS_URL} from './spec-editor.directive';
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
    let $compile, $state;

    /** The root scope of the spec-editor (the parent scope). */
    let $rootScope;

    /** The template cache of the spec-editor. */
    let $templateCache;

    /** The scope, compiled element and controller of the spec-editor. */
    let scope, element, specEditor;

    /** The parameters supplied for primary external configuration of designer directive. */
    let _scope, _element, _specEditor, _state, _compile, _templateCache;

    /** The parameters supplied for secondary external configuration of designer directive. */
    let __scope, __element, __specEditor;



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
        $provide.provider('$state', {$get: () => {return {}}}); // Produces 'Object {}'.
        $provide.factory('mdHelper', mdHelperFactory);

        // Configuration dependency.
        //$provide.provider('composerOverrides', {$get: () => {return {}}}); // Produces 'Object {}'.
        $provide.provider('composerOverrides', {
            $get: () => {
                return {
                    // NOTE, ORDER AND TYPES OF THESE PARAMETERS IS IMPORTANT,
                    // BRANDED VERSIONS OF BROOKLYN DEPEND ON IT.
                    // Primary configuration (called from the link).
                    configureSpecEditor: (specEditor, $scope, $element, $state, $compile, $templateCache) => {
                        _scope = $scope;
                        _state = $state;
                        _element = $element;
                        _compile = $compile;
                        _specEditor = specEditor;
                        _templateCache = $templateCache;
                    },
                    // Secondary configuration (called from the controller).
                    configureSpecEditorController: (specEditor, $scope, $element) => {
                        __scope = $scope;
                        __element = $element;
                        __specEditor = specEditor;
                    }
                }
            }
        });
    }));

    // Initialize the spec-editor.
    beforeEach(angular.mock.module(SpecEditor));

    // Create new instance of $injector to resolve references.
    beforeEach(angular.mock.inject(function(_$state_, _$compile_, _$rootScope_, _$templateCache_){
        $state = _$state_;
        $compile = _$compile_;
        $rootScope = _$rootScope_;
        $templateCache = _$templateCache_;

        // Compile a piece of HTML containing the directive
        $rootScope.testModel = new Entity();
        element = $compile('<spec-editor model="testModel"></spec-editor>')($rootScope);
        $rootScope.$digest();

        // Get the `scope` of the complied spec-editor directive.
        scope = element.isolateScope();

        // Get the `controller` instance of the complied spec-editor directive.
        specEditor = element.controller('spec-editor');
    }));

    it('Creates controller of the directive', () => {
        expect(specEditor).toBeDefined();
    });

    /**
     * Verifies that parameters, their order and types are set correctly for any external configuration. Configuration
     * is typically used in branded versions of Brooklyn.
     */
    it('Supplies expected parameters for external configuration of the designer directive', () => {

        // 2. Verify primary configuration.
        expect(_state).toBe($state); // Confirm expected `state` object.
        expect(_scope).toBe(scope); // Confirm expected `scope` object.
        expect(_element).toEqual(element); // Confirm expected `element` object.
        expect(_compile).toBe($compile); // Confirm expected `compile` object.
        expect(_specEditor).toBe(specEditor); // Confirm expected `controller` object.
        expect(_templateCache).toBe($templateCache); // Confirm expected `templateCache` object.

        // 2. Verify secondary configuration.
        expect(__scope).toBe(scope); // Confirm expected `scope` object.
        expect(__element).toEqual(element); // Confirm expected `element` object.
        expect(__specEditor).toBe(specEditor); // Confirm expected `controller` object.
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

        // one at the end can be added by overriding this (requires scriptTagDecorator on spec-editor directive, which it is)
        $templateCache.put(SUBSECTION_TEMPLATE_OTHERS_URL, '<br-collapsible><heading>Other</heading></br-collapsible>');
        // a custom one can be inserted in the middle
        $templateCache.put('custom-reqs', '<br-collapsible><heading>Requirements</heading></br-collapsible>');
        // a dummy one has no impact
        $templateCache.put('dummy-template.html', '<br-collapsible><heading>Dummy</heading></br-collapsible>');

        element = $compile('<spec-editor model="testModel"></spec-editor>')($rootScope);
        $templateCache.put(SUBSECTION_TEMPLATE_OTHERS_URL, '<br-collapsible><heading>Other</heading></br-collapsible>');

        $rootScope.$digest();

        _scope = element.isolateScope();
        let index = _scope.sections.findIndex(k => k.indexOf("entity-config")>=0) + 1;
        if (index<=0) index = _scope.sections.length;
        _scope.sections.splice(index, 0, 'custom-reqs');

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
