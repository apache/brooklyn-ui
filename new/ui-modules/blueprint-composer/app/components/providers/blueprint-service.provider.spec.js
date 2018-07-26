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
import {blueprintServiceProvider} from "./blueprint-service.provider";
import {dslServiceProvider} from "./dsl-service.provider";
import {catalogApiProvider} from "brooklyn-ui-utils/providers/catalog-api.provider";
import {locationApiProvider} from "brooklyn-ui-utils/providers/location-api.provider";
import {iconGeneratorProvider} from "brooklyn-ui-utils/icon-generator/icon-generator";
import {Entity} from "../util/model/entity.model";
import {paletteApiProvider} from './palette-api.provider';


describe('Blueprint Service', ()=> {
    let $rootScope, blueprintService;

    beforeEach(angular.mock.module(($provide)=> {
        $provide.provider('catalogApi', catalogApiProvider);
        $provide.provider('locationApi', locationApiProvider);
        $provide.provider('paletteApi', paletteApiProvider);
        $provide.provider('iconGenerator', iconGeneratorProvider);
        $provide.provider('dslService', dslServiceProvider);
        $provide.provider('blueprintService', blueprintServiceProvider);
    }));
    beforeEach(angular.mock.inject((_$rootScope_, _blueprintService_)=> {
        $rootScope = _$rootScope_;
        blueprintService = _blueprintService_;
    }));

    it('should load blueprint from YAML', ()=> {
        blueprintService.setFromYaml(YAML_BLUEPRINT);
        let bp = blueprintService.get();
        expect(bp instanceof Entity).toBe(true);
        expect(bp.hasName()).toBe(true);
        expect(bp.children.length).toBe(3);
        expect(bp.children[0].hasType()).toBe(true);
        expect(bp.children[0].type).toBe('com.example.Entity1');
        expect(blueprintService.getAsYaml()).toEqual(YAML_BLUEPRINT);
    });

    it('should return an entity by internal id', ()=> {
        blueprintService.setFromYaml(YAML_BLUEPRINT);
        for (let childId of blueprintService.get().childrenAsMap.keys()) {
            let childEntity = blueprintService.find(childId);
            expect(childEntity).toBeDefined();
            expect(childEntity).not.toBeNull();
            expect(childEntity._id).toEqual(childId);
        }
        let unknownEntity = blueprintService.find(Math.random().toString(36).slice(2))
        expect(unknownEntity).toBeDefined();
        expect(unknownEntity).toBeNull();
    });

});

const YAML_BLUEPRINT = '' +
    'name: Test Blueprint\n' +
    'services:\n' +
    '  - type: com.example.Entity1\n' +
    '  - type: com.example.Entity2\n' +
    '  - type: com.example.Entity3\n';
