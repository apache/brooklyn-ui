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
import {JsYamlParser, YamlParseNode} from './JsYamlParser'

describe('Extended js-yaml parser', function () {
    const TEST_YAML = '' +
        'scalar_key: scalar_value\n' +
        'mapping_key:\n' +
        '  1: mapping_val1\n' +
        '  2: mapping_val2\n' +
        '  3: mapping_val3\n' +
        'sequence_key:\n' +
        '- sequence_val1\n' +
        '- sequence_val2\n' +
        '- sequence_val3\n' +
        'null_key:';

    var jsYamlParser;


    beforeEach(function () {
        jsYamlParser = new JsYamlParser();
    });

    afterEach(function () {
    });

    describe('parsing a YAML string', function () {
        var parseObject;
        beforeEach(function () {
            parseObject = jsYamlParser.parse(TEST_YAML);
        });
        describe("YamlParseNode Object", function () {
            it('should parse a yaml string to a YamlParseNode', function () {
                expect(parseObject).not.toBeNull();
                expect(parseObject instanceof YamlParseNode).toBe(true);
                expect(parseObject.result).not.toBeNull();
                expect(parseObject.doc).toBe(TEST_YAML);
            });
            it('should have the correct number of child nodes', function () {
                expect(parseObject.children.length).toBe(8);
            });
            it('should parse YAML scalars', function () {
                //TEST KEY
                expect(parseObject.children[0]['doc']).toBe(TEST_YAML);
                expect(parseObject.children[0]['kind']).toBe('scalar');
                expect(parseObject.children[0]['result']).toBe('scalar_key');
                expect(parseObject.children[0]['children']).toBeDefined();
                expect(parseObject.children[0]['children'] instanceof Array).toBe(true);
                expect(parseObject.children[0]['children'].length).toBe(0);
                expect(parseObject.children[0]['parent']).toBe(parseObject);

                //TEST VALUE
                expect(parseObject.children[1]['doc']).toBe(TEST_YAML);
                expect(parseObject.children[1]['kind']).toBe('scalar');
                expect(parseObject.children[1]['result']).toBe('scalar_value');
                expect(parseObject.children[1]['children']).toBeDefined();
                expect(parseObject.children[1]['children'] instanceof Array).toBe(true);
                expect(parseObject.children[1]['children'].length).toBe(0);
                expect(parseObject.children[0]['parent']).toBe(parseObject)
            });
            it('should parse YAML mappings', function () {
                //TEST KEY
                expect(parseObject.children[2]['doc']).toBe(TEST_YAML);
                expect(parseObject.children[2]['kind']).toBe('scalar');
                expect(parseObject.children[2]['result']).toBe('mapping_key');
                expect(parseObject.children[2]['children']).toBeDefined();
                expect(parseObject.children[2]['children'] instanceof Array).toBe(true);
                expect(parseObject.children[2]['children'].length).toBe(0);
                expect(parseObject.children[2]['parent']).toBe(parseObject);

                //TEST VALUE
                expect(parseObject.children[3]['doc']).toBe(TEST_YAML);
                expect(parseObject.children[3]['kind']).toBe('mapping');
                expect(parseObject.children[3]['result']).not.toBeNull()
                expect(parseObject.children[3]['children']).toBeDefined();
                expect(parseObject.children[3]['children'] instanceof Array).toBe(true);
                expect(parseObject.children[3]['children'].length).toBe(6);
                expect(parseObject.children[3]['parent']).toBe(parseObject)
            });
            it('should parse YAML sequence', function () {
                //TEST KEY
                expect(parseObject.children[4]['doc']).toBe(TEST_YAML);
                expect(parseObject.children[4]['kind']).toBe('scalar');
                expect(parseObject.children[4]['result']).toBe('sequence_key');
                expect(parseObject.children[4]['children']).toBeDefined();
                expect(parseObject.children[4]['children'] instanceof Array).toBe(true);
                expect(parseObject.children[4]['children'].length).toBe(0);
                expect(parseObject.children[4]['parent']).toBe(parseObject);

                //TEST VALUE
                expect(parseObject.children[5]['doc']).toBe(TEST_YAML);
                expect(parseObject.children[5]['kind']).toBe('sequence');
                expect(parseObject.children[5]['result']).not.toBeNull()
                expect(parseObject.children[5]['children']).toBeDefined();
                expect(parseObject.children[5]['children'] instanceof Array).toBe(true);
                expect(parseObject.children[5]['children'].length).toBe(3);
                expect(parseObject.children[5]['parent']).toBe(parseObject)
            });
            it('should parse YAML nulls', function () {
                //TEST KEY
                expect(parseObject.children[6]['doc']).toBe(TEST_YAML);
                expect(parseObject.children[6]['kind']).toBe('scalar');
                expect(parseObject.children[6]['result']).toBe('null_key');
                expect(parseObject.children[6]['children']).toBeDefined();
                expect(parseObject.children[6]['children'] instanceof Array).toBe(true);
                expect(parseObject.children[6]['children'].length).toBe(0);
                expect(parseObject.children[6]['parent']).toBe(parseObject);

                //TEST VALUE
                expect(parseObject.children[7]['doc']).toBe(TEST_YAML);
                expect(parseObject.children[7]['kind']).toBeNull();
                expect(parseObject.children[7]['result']).toBeNull()
                expect(parseObject.children[7]['children']).toBeDefined();
                expect(parseObject.children[7]['children'] instanceof Array).toBe(true);
                expect(parseObject.children[7]['children'].length).toBe(0);
                expect(parseObject.children[7]['parent']).toBe(parseObject)
            });
        });
        describe("JSON Object", function () {
            it('should parse YAML scalars', function () {
                expect(parseObject.result['scalar_key']).not.toBeNull();
                expect(parseObject.result['scalar_key']).toBe('scalar_value');
            });
            it('should parse YAML mappings', function () {
                expect(parseObject.result['mapping_key']).not.toBeNull();
                for (var ref in parseObject.result['mapping_key']) {
                    expect(parseObject.result['mapping_key'][ref]).toBe('mapping_val' + ref);
                }
            });
            it('should parse YAML sequences', function () {
                expect(parseObject.result['sequence_key']).not.toBeNull();
                expect(parseObject.result['sequence_key'] instanceof Array).toBe(true);
                for (var ref in parseObject.result['sequence_key']) {
                    expect(parseObject.result['sequence_key'][ref]).toBe('sequence_val' + (parseInt(ref) + 1));
                }
            });
            it('should parse YAML nulls', function () {
                expect(parseObject.result['null_key']).toBeDefined();
                expect(parseObject.result['null_key']).toBeNull();
            });
            it('should not contain any extra fields', function () {
                for (var ref in parseObject.result) {
                    expect(ref).toMatch(/scalar_key|mapping_key|sequence_key|null_key/)
                }
            });
        });
    });
});