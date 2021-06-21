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

        it('Calls back when option button clicked in the single-selection confirmation menu', (done) => {
            expect(element.find('foreignObject').length).toBeFalsy(); // menu is not opened yet
            let blueprint = scope.blueprint;

            // Run method under test.
            _blueprintGraph.confirm(blueprint._id, 'message', ['choice1', 'choice2'], (confirmedChoice) => {
                expect(confirmedChoice).toEqual('choice2');
                done(); // this callback completes the test, or fails if this condition is not reached.
            });

            // Expect menu to be displayed.
            expect(element.find('foreignObject').length).not.toBeFalsy();

            // Click the button with the `choice2`.
            element.find('button')[1].click();

            // Expect menu to be closed.
            expect(element.find('foreignObject').length).toBeFalsy();
        });

        it('Calls back when Apply button clicked in the multi-selection confirmation menu with only option selected', (done) => {
            expect(element.find('foreignObject').length).toBeFalsy(); // menu is not opened yet
            let blueprint = scope.blueprint;

            // Run method under test.
            _blueprintGraph.confirm(blueprint._id, 'message', ['choice1'], (confirmedChoices) => {
                expect(confirmedChoices).toEqual(['choice1']);
                done(); // this callback completes the test, or fails if this condition is not reached.
            }, true); // true - to enable multi-selection mode.

            // Expect menu to be displayed.
            expect(element.find('foreignObject').length).not.toBeFalsy();

            // Expect `Apply` button to be enabled.
            expect(element.find('button')[0].disabled).toBe(false);

            // Click the `Apply` button.
            element.find('button')[0].click();

            // Expect menu to be closed.
            expect(element.find('foreignObject').length).toBeFalsy();
        });

        it('Calls back when Apply button clicked in the multi-selection confirmation menu with multiple options selected', (done) => {
            expect(element.find('foreignObject').length).toBeFalsy(); // menu is not opened yet
            let blueprint = scope.blueprint;

            // Run method under test.
            _blueprintGraph.confirm(blueprint._id, 'message', ['choice1', 'choice2'], (confirmedChoices) => {
                expect(confirmedChoices).toEqual(['choice1', 'choice2']);
                done(); // this callback completes the test, or fails if this condition is not reached.
            }, true); // true - to enable multi-selection mode.

            // Expect menu to be displayed.
            expect(element.find('foreignObject').length).not.toBeFalsy();

            // Expect `Apply` button to be disabled.
            expect(element.find('button')[0].disabled).toBe(true);

            // Tick every check-box
            for (let inputElement of Object.values(element.find('input'))) {

                if (inputElement.dispatchEvent) {
                    expect(inputElement.checked).toBe(false); // check-box is un-ticked

                    // Tick check-box.
                    inputElement.click();
                    inputElement.dispatchEvent(new Event('change'));

                    expect(inputElement.checked).toBe(true); // check-box is ticked now
                }
            }

            // Expect `Apply` button to be enabled now.
            expect(element.find('button')[0].disabled).toBe(false);

            // Click the `Apply` button.
            element.find('button')[0].click();

            // Expect menu to be closed.
            expect(element.find('foreignObject').length).toBeFalsy();
        });

        it('Calls back when Apply button clicked in the multi-selection confirmation menu with single option selected from many', (done) => {
            expect(element.find('foreignObject').length).toBeFalsy(); // menu is not opened yet
            let blueprint = scope.blueprint;

            // Run method under test.
            _blueprintGraph.confirm(blueprint._id, 'message', ['choice1', 'choice2'], (confirmedChoices) => {
                expect(confirmedChoices).toEqual(['choice2']);
                done(); // this callback completes the test, or fails if this condition is not reached.
            }, true); // true - to enable multi-selection mode.

            // Expect menu to be displayed.
            expect(element.find('foreignObject').length).not.toBeFalsy();

            // Expect `Apply` button to be disabled.
            expect(element.find('button')[0].disabled).toBe(true);

            // Tick the second check-box with 'choice2'.
            let inputElement = element.find('input')[1];

            // Tick check-box.
            inputElement.click();
            inputElement.dispatchEvent(new Event('change'));

            // Expect `Apply` button to be enabled now.
            expect(element.find('button')[0].disabled).toBe(false);

            // Click the `Apply` button.
            element.find('button')[0].click();

            // Expect menu to be closed.
            expect(element.find('foreignObject').length).toBeFalsy();
        });

        it('Calls back when Apply button clicked in the multi-selection confirmation menu with a single option selected from multiple choices with the same name', (done) => {
            expect(element.find('foreignObject').length).toBeFalsy(); // menu is not opened yet
            let blueprint = scope.blueprint;

            // Prepare choices in a form of objets with distinct ID and implemented toString method.
            let choices = [
                {
                    toString: () => 'choice1', // same name, option 1
                    id: 1 // distinct ID
                },
                {
                    toString: () => 'choice1', // same name, option 2
                    id: 2 // distinct ID
                }
            ];

            // Run method under test, this time supply multiple choices with same names but distinct IDs
            _blueprintGraph.confirm(blueprint._id, 'message', choices, (confirmedChoices) => {
                expect(confirmedChoices.length).toEqual(1);
                expect(confirmedChoices[0].id).toEqual(2); // ID of the second option
                expect('' + confirmedChoices[0]).toEqual('choice1'); // sting value of a selected option
                done(); // this callback completes the test, or fails if this condition is not reached.
            }, true); // true - to enable multi-selection mode.

            // Expect menu to be displayed.
            expect(element.find('foreignObject').length).not.toBeFalsy();

            // Expect `Apply` button to be disabled.
            expect(element.find('button')[0].disabled).toBe(true);

            // Tick the second check-box with option 2.
            let inputElement = element.find('input')[1];

            // Tick check-box.
            inputElement.click();
            inputElement.dispatchEvent(new Event('change'));

            // Expect `Apply` button to be enabled now.
            expect(element.find('button')[0].disabled).toBe(false);

            // Click the `Apply` button.
            element.find('button')[0].click();

            // Expect menu to be closed.
            expect(element.find('foreignObject').length).toBeFalsy();
        });

        it('Apply button is disabled if no options selected in the multi-selection confirmation menu', () => {
            expect(element.find('foreignObject').length).toBeFalsy(); // menu is not opened yet
            let blueprint = scope.blueprint;

            // Run method under test.
            _blueprintGraph.confirm(blueprint._id, 'message', ['choice1', 'choice2'], (confirmedChoices) => {
                fail('callback is not expected');
            }, true); // true - to enable multi-selection mode.

            // Expect menu to be displayed.
            expect(element.find('foreignObject').length).not.toBeFalsy();

            // Expect `Apply` button to be disabled.
            expect(element.find('button')[0].disabled).toBe(true);

            // Try to click the `Apply` button.
            element.find('button')[0].click();

            // Expect menu not to be closed because `Apply` button was not-clickable.
            expect(element.find('foreignObject').length).toBeTruthy();
        });

        it('Does not offer confirmation menu in case of invalid arguments', () => {
            let blueprint = scope.blueprint;
            _blueprintGraph.confirm(blueprint._id, 'message', null, () => {}); // choices is null
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm(blueprint._id, 'message', [], () => {}); // choices is an empty array
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm(null, 'message', ['choice1', 'choice2'], () => {}); // node ID is null
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm('', 'message', ['choice1', 'choice2'], () => {}); // node ID is empty
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm(blueprint._id, null, ['choice1', 'choice2'], () => {}); // confirmation message is null
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm(blueprint._id, '', ['choice1', 'choice2'], () => {}); // confirmation message is empty
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm(blueprint._id, 'message', ['choice1', 'choice2'], null); // callback is null
            expect(element.find('foreignObject').length).toBeFalsy();
            _blueprintGraph.confirm(blueprint._id, 'message', ['choice1', 'choice2'], 'string'); // callback is not a function
            expect(element.find('foreignObject').length).toBeFalsy();
        });

        it('Closes the node confirmation menu', () => {
            let blueprint = scope.blueprint;

            // Run method under test.
            _blueprintGraph.confirm(blueprint._id, 'message', ['choice1', 'choice2'], () => {
                fail('Callback with confirmed choice is not expected here!');
            });

            // Expect menu to be displayed.
            expect(element.find('foreignObject').length).not.toBeFalsy();

            // Close the window - click the button with the cross `X`.
            element.find('i')[0].click();

            // Expect menu to be closed.
            expect(element.find('foreignObject').length).toBeFalsy();
        });
    });
});

