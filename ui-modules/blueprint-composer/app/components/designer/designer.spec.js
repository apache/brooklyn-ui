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

/**
 * Tests for the designer directive.
 */
describe('Designer', () => {

    /** The template compiler of the designer */
    let $compile;

    /** The root scope of the designer (the parent scope). */
    let $rootScope;

    /** The compiled element of the designer. */
    let element;

    // Prepare dependencies for the spec-editor.
    beforeEach(angular.mock.module(($provide) => {

        // Dependencies of the blueprint service.
        $provide.provider('catalogApi', catalogApiProvider);
        $provide.provider('locationApi', locationApiProvider);
        $provide.provider('paletteApi', paletteApiProvider);
        $provide.provider('iconGenerator', iconGeneratorProvider);
        $provide.provider('dslService', dslServiceProvider);
        $provide.provider('brBrandInfo', {$get: () => {}}); // Produces 'undefined', not needed just now.


        // Dependencies of the spec-editor.
        $provide.provider('$state', {$get: () => {}}); // Produces 'undefined', not needed just now.
        $provide.provider('blueprintService', blueprintServiceProvider);
        $provide.provider('composerOverrides', {$get: () => {return {}}}); // Produces 'Object {}'.
        $provide.provider('paletteDragAndDropService', paletteDragAndDropServiceProvider);
        $provide.factory('brSnackbar', brSnackbar);
    }));

    // Initialize the designer.
    beforeEach(angular.mock.module(Designer));

    // Create new instance of $injector to resolve references.
    beforeEach(angular.mock.inject(function(_$compile_, _$rootScope_){
        $compile = _$compile_;
        $rootScope = _$rootScope_;

        // Compile a piece of HTML containing the directive
        $rootScope.onCanvasSelection = (item) => {};
        element = $compile('<designer on-selection-change="onCanvasSelection"></designer>')($rootScope);
        $rootScope.$digest();
    }));

    // Ignored, for now
    xit('Creates controller of the directive', () => {
        let specEditor = element.controller('designer');
        expect(specEditor).toBeDefined();
    });
});

