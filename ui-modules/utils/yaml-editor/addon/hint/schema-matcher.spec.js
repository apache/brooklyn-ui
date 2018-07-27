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
import {SchemaMatcher} from './schema-matcher';

describe('SchemaMatcher class', () => {
    let schemaMatcher;

    beforeEach(() => {
        schemaMatcher = new SchemaMatcher();
    });

    describe('registerSchema() method', () => {
        it('throws an exception if the schema does not have an $id', () => {
            expect(() => (schemaMatcher.registerSchema({title: 'My invalid Schema'}))).toThrowError('Schema miss "$id" property');
        });
        it('registers a given schema', () => {
            schemaMatcher.registerSchema(bar);

            expect(schemaMatcher.schemas.has(bar.$id)).toBeTruthy();
            expect(schemaMatcher.schemas.size).toEqual(1);
        });
    });

    describe('findProperties() method', () => {
        it('returns a promise', () => {
            schemaMatcher.registerSchema(bar);

            let object = schemaMatcher.findProperties({}, root, 0);

            expect(object instanceof Promise).toBeTruthy();
        });

        describe('rejects the promise', () => {
            it('if a definition schema is not registered', (done) => {
                schemaMatcher.findProperties({}, invalidDefSchema, 0).then(() => {
                    done.fail('Promise has been resolved');
                }).catch((ex) => {
                    expect(ex instanceof Error).toBeTruthy();
                    expect(ex.message).toEqual('Schema with id "invalid/path/to/hello" is not registered');
                    done();
                });
            });
            it('if a referenced schema is not registered', (done) => {
                schemaMatcher.findProperties({}, root, 0).then(() => {
                    done.fail('Promise has been resolved');
                }).catch((ex) => {
                    expect(ex instanceof Error).toBeTruthy();
                    expect(ex.message).toEqual('Schema with id "/root/bar" is not registered');
                    done();
                });
            });
        });

        describe('resolves the promise with properties from', () => {
            beforeEach(() => {
                schemaMatcher.registerSchema(bar);
            });

            it('basic schema', (done) => {
                schemaMatcher.findProperties({}, root, 0).then((results) => {
                    expect(results.length).toEqual(Object.keys(root.properties).length);
                    results.forEach(result => {
                        expect(Object.keys(root.properties).indexOf(result.$key)).toBeGreaterThan(-1);
                    });
                    done();
                }).catch((ex) => {
                    done.fail('Promise has been rejected');
                });
            });
            it('definition schema', (done) => {
                schemaMatcher.findProperties({object: {}}, root, 1).then((results) => {
                    expect(results.length).toEqual(Object.keys(root.definitions.object.properties).length);
                    results.forEach(result => {
                        expect(Object.keys(root.definitions.object.properties).indexOf(result.$key)).toBeGreaterThan(-1);
                    });
                    done();
                }).catch((ex) => {
                    done.fail('Promise has been rejected');
                });
            });
            it('ref schema', (done) => {
                schemaMatcher.findProperties({bar: {}}, root, 1).then((results) => {
                    expect(results.length).toEqual(Object.keys(bar.properties).length);
                    results.forEach(result => {
                        expect(Object.keys(bar.properties).indexOf(result.$key)).toBeGreaterThan(-1);
                    });
                    done();
                }).catch((ex) => {
                    done.fail('Promise has been rejected');
                });
            });
            it('schemas defined by an operator', (done) => {
                schemaMatcher.findProperties({world: [{}]}, root, 1).then((results) => {
                    let expectedProperties = Object.assign({}, bar.properties, root.definitions.object.properties);

                    expect(results.length).toEqual(Object.keys(expectedProperties).length);
                    results.forEach(result => {
                        expect(Object.keys(expectedProperties).indexOf(result.$key)).toBeGreaterThan(-1);
                    });
                    done();
                }).catch((ex) => {
                    done.fail('Promise has been rejected');
                });
            });
            it('non-matching level', (done) => {
                schemaMatcher.findProperties({}, bar, 1).then((results) => {
                    expect(results.length).toEqual(0);
                    done();
                }).catch((ex) => {
                    done.fail('Promise has been rejected');
                });
            });
            it('a schema without properties', (done) => {
                schemaMatcher.findProperties({hello: ''}, root, 1).then((results) => {
                    expect(results.length).toEqual(0);
                    done();
                }).catch((ex) => {
                    done.fail('Promise has been rejected');
                });
            });
        });
    });
});

let root = {
    $id: '/root',
    title: 'Root object',
    type: 'object',
    properties: {
        foo: {
            type: 'string',
            title: 'Foo string',
            enum: ['a', 'b', 'c']
        },
        bar: {
            $ref: '/root/bar'
        },
        object: {
            $ref: '#/definitions/object'
        },
        hello: {
            $ref: '#/definitions/hello'
        },
        world: {
            type: 'array',
            title: 'World array',
            items: {
                anyOf: [
                    {
                        $ref: '#/definitions/object',
                        title: 'World item object'
                    },
                    {
                        $ref: '/root/bar',
                        title: 'World item bar'
                    }
                ]
            }
        }
    },
    definitions: {
        object: {
            title: 'Object object',
            type: 'object',
            properties: {
                a: {
                    type: 'string',
                    title: 'A string'
                },
                b: {
                    type: 'string',
                    title: 'B string'
                },
                c: {
                    type: 'string',
                    title: 'C string'
                }
            }
        },
        hello: {
            type: 'array',
            title: 'Hello array',
            items: {
                type: 'string'
            },
            minItems: 1
        }
    }
};

let bar = {
    $id: '/root/bar',
    title: 'Bar object',
    type: 'object',
    properties: {
        x: {
            type: 'string',
            title: 'X string'
        },
        y: {
            type: 'string',
            title: 'Y string'
        },
        z: {
            type: 'string',
            title: 'Z string'
        }
    }
};

let invalidDefSchema = {
    $id: '/root',
    title: 'Root object',
    type: 'object',
    properties: {
        foo: {
            $ref: '#/invalid/path/to/hello'
        }
    },
    definitions: {
        hello: {
            type: 'string',
            title: 'Hello string'
        }
    }
};