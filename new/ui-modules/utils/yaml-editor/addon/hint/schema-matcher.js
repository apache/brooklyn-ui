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
const TYPE = {
    null: 'null',
    boolean: 'boolean',
    object: 'object',
    array: 'array',
    number: 'number',
    string: 'string'
};
const CONDITION = {
    anyOf: 'anyOf',
    oneOf: 'oneOf',
    allOf: 'allOf'
};

/**
 * Find the related schema, based on an input JSON and the level (how deep are we in the json) and return the list of
 * defined properties.
 */
export class SchemaMatcher {
    constructor() {
        this.schemas = new Map();
    }

    /**
     * Register a JSON schema, to be referenced by other schemas. Will throw an exception if the field "$id" is not
     * defined, as per as the specification.
     *
     * @param {Object} schema The schema to register
     */
    registerSchema(schema) {
        if (!schema.hasOwnProperty('$id')) {
            throw new Error('Schema miss "$id" property');
        }
        this.schemas.set(schema.$id, schema);
    }

    /**
     * Find and retrieve the properties, based on the matching schema for the given json and level. Returns a promise
     * that will be resolved with an array of properties. If for the given level, a schema is defined by a operator
     * such as "oneOf", "anyOf", etc, the resolved properties array will contains all properties for all schemas
     * defined by this operator.
     *
     * The promise will be rejected if a referenced schema is encountered but not registered.
     *
     * @param {Object} json The JSON object
     * @param {Object} schema The root schema defining the given json
     * @param {Integer} level The level to get the properties from
     * @return {Promise}
     */
    findProperties(json, schema, level) {
        return new Promise((resolve, reject) => {
            try {
                resolve(this._findProperties(json, schema, level, 0));
            } catch (ex) {
                reject(ex);
            }
        })
    }

    _findProperties(json, schema, level, currentLevel) {
        // We are at the right level, let's return the resolved properties
        if (currentLevel === level) {
            return this._resolveProperties(schema);
        }

        // Retrieve the last key of the JSON to get the properties from
        let keys = Object.keys(json || {});
        let key = keys[keys.length - 1];

        // If the schema declare a type, then we resolve the properties based on that
        if (schema.hasOwnProperty('type')) {
            let subSchema;
            let subLevel = currentLevel;
            let subJson = json[key] || {};

            switch (schema.type) {
                case TYPE.object:
                    subSchema = schema.properties[key];
                    break;
                case TYPE.array:
                    subSchema = schema.items;
                    break;
            }

            if (!subSchema) {
                return [];
            }

            if (subSchema.type === TYPE.array) {
                subLevel = subLevel - 1;
            }

            if (subSchema.hasOwnProperty('$ref')) {
                return this._findProperties(subJson, Object.assign({}, this._resolveSchema(schema, subSchema.$ref), subSchema), level, subLevel + 1);
            }

            let condition = Object.keys(subSchema).find(key => Object.keys(CONDITION).some(condition => condition === key));
            if (condition) {
                return subSchema[condition].reduce((properties, subSchema) => {
                    let resolvedSubSchema = subSchema;
                    if (subSchema.hasOwnProperty('$ref')) {
                        resolvedSubSchema = Object.assign({}, this._resolveSchema(schema, subSchema.$ref), subSchema);
                    }
                    return properties.concat(this._findProperties(subJson, resolvedSubSchema, level, subLevel + 1));
                }, []);
            }

            return this._findProperties(subJson, Object.assign({definitions: schema.definitions}, subSchema), level, subLevel + 1);
        }

        // If we have any conditions (i.e. anyOf, oneOf, etc) we iterate over the sub-schemas, resolve them
        // if we need to and concat all their properties
        let condition = Object.keys(schema).find(key => Object.keys(CONDITION).some(condition => condition === key));
        if (condition) {
            return schema[condition].reduce((properties, subSchema) => {
                let resolvedSubSchema = subSchema;
                if (subSchema.hasOwnProperty('$ref')) {
                    resolvedSubSchema = Object.assign({}, this._resolveSchema(schema, subSchema.$ref), subSchema);
                }
                return properties.concat(this._findProperties(json, resolvedSubSchema, level, currentLevel));
            }, []);
        }

        // If we arrive here, it means tht the schema does not have anything useful so return an empty array
        return [];
    }

    _resolveSchema(baseSchema, $ref) {
        if ($ref.startsWith('#/')) {
            let refSchema = baseSchema;
            let path = $ref.replace('#/', '').split('/');
            for (let i = 0; i < path.length; i++) {
                if (!refSchema.hasOwnProperty(path[i])) {
                    throw new Error(`Schema with id "${$ref.replace('#/', '')}" is not registered`)
                }
                refSchema = refSchema[path[i]];
            }
            return Object.assign({definitions: baseSchema.definitions}, refSchema);
        }

        if (!this.schemas.has($ref)) {
            throw new Error(`Schema with id "${$ref}" is not registered`);
        }
        return this.schemas.get($ref);
    }

    _resolveProperties(schema) {
        // If the schema has some properties, we resolve them is we need to and return them
        if (schema.hasOwnProperty('properties')) {
            return Object.keys(schema.properties).map(key => {
                return Object.assign({'$key': key},
                    schema.properties[key].hasOwnProperty('$ref') ?
                    this._resolveSchema(schema, schema.properties[key]['$ref']) :
                    schema.properties[key]);
            });
        }

        // If we have any conditions (i.e. anyOf, oneOf, etc) we iterate over the sub-schemas, resolve them
        // if we need to and concat all their properties
        let condition = Object.keys(schema).find(key => Object.keys(CONDITION).some(condition => condition === key));
        if (condition) {
            return schema[condition].reduce((properties, subSchema) => {
                let resolvedSubSchema = subSchema;
                if (subSchema.hasOwnProperty('$ref')) {
                    resolvedSubSchema = Object.assign({}, this._resolveSchema(schema, subSchema.$ref), subSchema);
                }
                return properties.concat(this._resolveProperties(resolvedSubSchema));
            }, []);
        }

        return [];
    }
}
