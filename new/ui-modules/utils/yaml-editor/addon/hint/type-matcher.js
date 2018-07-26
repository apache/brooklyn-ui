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
/**
 * Creates a new type provider that will fire an XHR request to the given endpoint, if the given match function return true.
 */
export class TypeProvider {
    /**
     * Instantiate a new TypeProvider.
     *
     * @param {String} endpoint The endpoint to hit for the XHR request.
     * @param {Function} match A function that must return a boolean. For instance, true if the XHR request must be
     * executed, false otherwise. It takes a single string argument.
     */
    constructor(endpoint, match) {
        this.endpoint = endpoint;
        this.callback = match;
        this.cache = new WeakMap();
    }

    /**
     * Call the registered match function and passed back the results.
     *
     * @param {Array} array An array of string values.
     * @return {Boolean}
     */
    match(array) {
        return this.callback(array[array.length - 1]);
    }

    /**
     * Get the response from the REST API, based on the given endpoint in the constructor. The promise will be resolved
     * if the response returns a 200 AND can be JSON parsed. Will be rejected otherwise.
     *
     * @return {Promise}
     */
    get() {
        return new Promise((resolve, reject) => {
            if (this.cache.has(this)) {
                resolve(this.cache.get(this));
                return;
            }

            let client = new XMLHttpRequest();
            client.onload = () => {
                if (client.status === 200 && client.responseText) {
                    try {
                        let response = JSON.parse(client.responseText);
                        this.cache.set(this, response);
                        resolve(response);
                    } catch (ex) {
                        reject(ex);
                    }
                } else {
                    reject(new Error(`Request with endpoint "${this.endpoint} returned an HTTP code of ${client.status}`));
                }
            };
            client.onerror = () => {
                reject(new Error(`Endpoint "${this.endpoint} cannot be reached`));
            };
            client.open('GET', this.endpoint);
            client.send();
        });
    }
}

/**
 * Check the available types' suggestions, based on the registered providers.
 */
export class TypeMatcher {
    constructor() {
        this.providers = [];
    }

    /**
     * Register a provider to check for the types' suggestions. If the given provider is not a type of TypeProvider,
     * it will simply vbe ignored.
     *
     * @param {TypeProvider} provider A provider to register
     */
    registerProvider(provider) {
        if (provider instanceof TypeProvider) {
            this.providers.push(provider);
        }
    }

    /**
     * Find and retrieve the types, based on the matching provider for the given json. Returns a promise that will be
     * resolved with an array of Brooklyn objects.
     *
     * The promise will be rejected if any network call fails.
     *
     * @param {Object} json The JSON object
     * @param {Array} path The current path to get to the last key/value
     * @return {Promise}
     */
    findTypes(json, path = []) {
        let object = json || {};
        let keys = Object.keys(object);
        let key = keys[keys.length - 1];

        if (key === 'type') {
            return this._buildPromise(path);
        }
        if (key === 'location') {
            path.push(key);
            return this._buildPromise(path);
        }

        if (object.hasOwnProperty(key)) {
            if (isNaN(key)) {
                path.push(key);
            }
            if (object[key] instanceof Object || object[key] instanceof Array) {
                return this.findTypes(object[key], path);
            }
        }

        return Promise.resolve([]);
    }

    _buildPromise(path) {
        return Promise.all(this.providers
            .filter(provider => provider.match(path))
            .map(provider => provider.get())).then(results => {
                return results.reduce((array, result) => (array.concat(result)), []);
            });
    }
}
