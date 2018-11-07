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
import {Dsl, DslParser, KIND} from "../util/model/dsl.model";
import {Entity} from "../util/model/entity.model";

const MODULE_NAME = 'brooklyn.composer.service.dsl-service';
const TAG = 'SERVICE :: DSL :: ';

angular.module(MODULE_NAME, [])
    .provider('dslService', dslServiceProvider);

export default MODULE_NAME;

export function dslServiceProvider() {
    return {
        $get: ['$log', function ($log) {
            return new DslService($log);
        }]
    }
}

/**
 *
 * @param $log
 * @return {{parse: parse, generate: generate}}
 * @constructor
 */
function DslService($log) {

    return {
        parse: parse,
        generate: generate,
    };

    /**
     * Parses a string containing a DSL expression and resolve its references to Entities
     * @param dsl the string to parse
     * @param {Entity} entity the base Entity to resolve relative references from
     * @param {Entity} blueprint the root Entity
     * @return {Dsl} a Dsl object containing relationships (referenced Entities)
     */
    function parse(dsl, entity, blueprint) {
        return new DslParser(dsl).parse(entity, function lookupById(id, entity = blueprint) {
            if (entity.id === id) {
                return entity;
            }
            for (let child of entity.childrenAsMap.values()) {
                let ret = lookupById(id, child);
                if (ret !== null) {
                    return ret;
                }
            }
            return null;
        });
    }

    /**
     * Generates the DSL representation for a Dsl object
     * @param dsl
     * @return {string}
     */
    function generate(dsl) {
        if (!dsl) {
            throw new Error('"dsl" param must be specified');
        }
        if (!(dsl instanceof Dsl)) {
            throw new Error('"dsl" param must be an instance of Dsl');
        }
        return dsl.getRoot().toString();
    }

}
