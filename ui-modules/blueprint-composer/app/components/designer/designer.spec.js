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

import Designer from './designer.directive';
import {iconGeneratorProvider} from 'brooklyn-ui-utils/icon-generator/icon-generator';
import {locationApiProvider} from 'brooklyn-ui-utils/providers/location-api.provider';
import {catalogApiProvider} from 'brooklyn-ui-utils/providers/catalog-api.provider';
import {brSnackbar} from 'brooklyn-ui-utils/br-core/snackbar/snackbar';
import {paletteApiProvider} from '../providers/palette-api.provider';
import {dslServiceProvider} from '../providers/dsl-service.provider';
import {blueprintServiceProvider} from '../providers/blueprint-service.provider';
import {paletteDragAndDropServiceProvider} from '../providers/palette-dragndrop.provider';
import {Entity} from "../util/model/entity.model";

/**
 * Tests for the designer directive.
 */
describe('Designer', () => {

    /** The template compiler of the designer */
    let $compile;

    /** The root scope of the designer (the parent scope). */
    let $rootScope;

    /** The scope and compiled element of the designer. */
    let scope, element;

    /** The parameters supplied for external configuration of designer directive. */
    let _scope, _element, _blueprintGraph;

    // Prepare dependencies for the designer.
    beforeEach(angular.mock.module(($provide) => {

        // Dependencies of the blueprint service.
        $provide.provider('catalogApi', catalogApiProvider);
        $provide.provider('locationApi', locationApiProvider);
        $provide.provider('paletteApi', paletteApiProvider);
        $provide.provider('iconGenerator', iconGeneratorProvider);
        $provide.provider('dslService', dslServiceProvider);
        $provide.provider('brBrandInfo', {$get: () => {}}); // Produces 'undefined', not needed just now.

        // Dependencies of the designer.
        $provide.provider('$state', {$get: () => {}}); // Produces 'undefined', not needed just now.
        $provide.provider('blueprintService', blueprintServiceProvider);
        $provide.provider('paletteDragAndDropService', paletteDragAndDropServiceProvider);
        $provide.factory('brSnackbar', brSnackbar);

        // Configuration dependency.
        $provide.provider('composerOverrides', {
            $get: () => {
                return {
                    // NOTE, ORDER AND TYPES OF THESE PARAMETERS IS IMPORTANT,
                    // BRANDED VERSIONS OF BROOKLYN DEPEND ON IT.
                    configureDesignerDirective: ($scope, $element, blueprintGraph) => {
                        _scope = $scope;
                        _element = $element;
                        _blueprintGraph = blueprintGraph;
                    }
                }
            }
        });
    }));

    // Initialize the designer.
    beforeEach(angular.mock.module(Designer));

    // Create new instance of $injector to resolve references.
    beforeEach(angular.mock.inject(function(_$compile_, _$rootScope_){
        $compile = _$compile_;
        $rootScope = _$rootScope_;

        // Compile a piece of HTML containing the directive.
        $rootScope.onCanvasSelection = (item) => {};
        element = $compile('<designer on-selection-change="onCanvasSelection"></designer>')($rootScope);
        $rootScope.$digest();

        // Get the `scope` of the complied designer directive.
        scope = element.isolateScope();
    }));

    /**
     * Verifies that parameters, their order and types are set correctly for any external configuration. Configuration
     * is typically used in branded versions of Brooklyn.
     */
    it('Supplies expected parameters for external configuration of the designer directive', () => {
        expect(_scope).toBe(scope); // Confirm expected `scope` object.
        expect(_element).toEqual(element); // Confirm expected `element` object.

        // Confirm that `blueprintGraph` is a type of D3Blueprint class. Note, Constructor of D3Blueprint returns
        // object with methods, class name is not available.
        expect(typeof _blueprintGraph.draw).toBe('function');
        expect(typeof _blueprintGraph.center).toBe('function');
        expect(typeof _blueprintGraph.update).toBe('function');
        expect(typeof _blueprintGraph.select).toBe('function');
        expect(typeof _blueprintGraph.confirm).toBe('function');
        expect(typeof _blueprintGraph.unselect).toBe('function');
    });

    describe('D3Blueprint', () => {

        it('Calls back on option selected in the node confirmation menu', (done) => {
            expect(element.find('foreignObject').length).toBeFalsy(); // menu is not opened yet
            let blueprint = scope.blueprint;
            _blueprintGraph.confirm(blueprint._id, 'message', ['choice1', 'choice2'], (confirmedChoice) => {
                expect(confirmedChoice).toEqual('choice2');
                done(); // this callback completes the test, or fails if this condition is not reached.
            });
            expect(element.find('foreignObject').length).not.toBeFalsy(); // menu is displayed
            element.find('button')[1].click(); // Click the button with the `choice2`.
            expect(element.find('foreignObject').length).toBeFalsy(); // menu is closed
        });

        it('Does not offer confirmation menu in case of invalid arguments', () => {
            let blueprint = scope.blueprint;
            _blueprintGraph.confirm(blueprint._id, 'message', null, () => {});
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm(blueprint._id, 'message', [], () => {});
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm(null, 'message', ['choice1', 'choice2'], () => {});
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm('', 'message', ['choice1', 'choice2'], () => {});
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm(blueprint._id, null, ['choice1', 'choice2'], () => {});
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm(blueprint._id, '', ['choice1', 'choice2'], () => {});
            expect(element.find('foreignObject').length).toBeFalsy();
        });

        it('Closes the node confirmation menu', () => {
            let blueprint = scope.blueprint;
            _blueprintGraph.confirm(blueprint._id, 'message', ['choice1', 'choice2'], () => {
                fail('Callback with confirmed choice is not expected here!');
            });
            expect(element.find('foreignObject').length).not.toBeFalsy(); // menu is displayed
            element.find('i')[0].click(); // Close the window - click the button with the cross `X`.
            expect(element.find('foreignObject').length).toBeFalsy(); // menu is closed
        });
    });
});

