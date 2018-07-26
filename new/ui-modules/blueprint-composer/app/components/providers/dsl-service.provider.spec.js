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
import {Dsl, DslParser, KIND} from "../util/model/dsl.model";
import {Entity} from "../util/model/entity.model";
import {dslServiceProvider} from "./dsl-service.provider";
import {blueprintServiceProvider} from "./blueprint-service.provider";
import {catalogApiProvider} from "brooklyn-ui-utils/providers/catalog-api.provider";
import {locationApiProvider} from "brooklyn-ui-utils/providers/location-api.provider";
import {iconGeneratorProvider} from "brooklyn-ui-utils/icon-generator/icon-generator";


describe('Dsl Service', ()=> {
    let $rootScope, dslService;

    beforeEach(angular.mock.module(($provide)=> {
        $provide.provider('catalogApi', catalogApiProvider);
        $provide.provider('locationApi', locationApiProvider);
        $provide.provider('iconGenerator', iconGeneratorProvider);
        $provide.provider('blueprintService', blueprintServiceProvider);
        $provide.provider('dslService', dslServiceProvider);
    }));
    beforeEach(angular.mock.inject((_$rootScope_, _dslService_)=> {
        $rootScope = _$rootScope_;
        dslService = _dslService_;
    }));

    it('should skip relationships to self()', ()=> {
        let entity1 = new Entity();
        const CONFIG_OBJECT = {
            textKey: 'textValue1',
            boolKey: false,
            numKey: 123456789,
            nullKey: null,
            objectKey: {
                key: 'val1',
            }
        };
        entity1.setEntityFromJson(CONFIG_OBJECT);

        let target_expr = '$brooklyn:self().attributeWhenReady("http.port")';
        let dsl = dslService.parse(target_expr, entity1, entity1);

        expect(dsl.relationships.length).toBe(0);
    });

    it('should resolve relationships to parent()', ()=> {
        let entity1 = new Entity();
        const CONFIG_OBJECT1 = {
            textKey: 'textValue1',
            boolKey: false,
            numKey: 123456789,
            nullKey: null,
            objectKey: {
                key: 'val1',
            }
        };
        entity1.setEntityFromJson(CONFIG_OBJECT1);

        let entity2 = new Entity();
        const CONFIG_OBJECT2 = {
            textKey: 'textValue2',
            boolKey: false,
            numKey: 123456789,
            nullKey: null,
            objectKey: {
                key: 'val2',
            }
        };
        entity2.setEntityFromJson(CONFIG_OBJECT2);

        entity2.parent = entity1;

        let target_expr = '$brooklyn:self().parent().attributeWhenReady("http.port")';
        let dsl = dslService.parse(target_expr, entity2, entity1);

        expect(dsl.relationships.length).toBe(1);
        expect(dsl.relationships.includes(entity1)).toBe(true);
    });

    it('should populate issues for non-existing nested entities', ()=> {
        let entity1 = new Entity();
        const CONFIG_OBJECT = {
            textKey: 'textValue1',
            boolKey: false,
            numKey: 123456789,
            nullKey: null,
            objectKey: {
                key: 'val1',
            }
        };
        entity1.setEntityFromJson(CONFIG_OBJECT);

        let target_expr = '$brooklyn:formatString("%s:%s", $brooklyn:component("foo").attributeWhenReady("host.name"), $brooklyn:component("bar").attributeWhenReady("http.port"))';
        let dsl = dslService.parse(target_expr, entity1, entity1);

        expect(dsl.relationships.length).toBe(0);
        // look for issues containing "foo", "bar"
        let issues = dsl.getAllIssues();
        expect(issues.length).toBe(2);
        expect(issues[0].search(/foo|bar/)).toBeGreaterThan(-1);
        expect(issues[1].search(/foo|bar/)).toBeGreaterThan(-1);
    });
});
