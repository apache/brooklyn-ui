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

const KEYS = {
    COMPOSER_QUERY: 'composerQuery',
    SECTION: 'composerSection',
    VIEW_MODE: 'composerViewMode',
}

const getterFor = (storageType, key) => (parseAsJSON=false) => {
    let result;
    try {
        result = parseAsJSON
            ? JSON.parse(storageType.getItem(key))
            : storageType.getItem(key);
    } catch (err) {
        result = undefined;
    }
    return result;
}

const setterFor = (storageType, key) => (newValue, isJSON) =>
    storageType.setItem(key, isJSON ? JSON.stringify(newValue) : newValue)

const storageFor = (storageType) => ({
    getComposerViewMode: getterFor(storageType, KEYS.VIEW_MODE),
    setComposerViewMode: setterFor(storageType, KEYS.VIEW_MODE),
    getComposerSection: getterFor(storageType, KEYS.SECTION),
    setComposerSection: setterFor(storageType, KEYS.SECTION),
    getComposerSearch: getterFor(storageType, KEYS.COMPOSER_QUERY),
    setComposerSearch: setterFor(storageType, KEYS.COMPOSER_QUERY),
})

export const session = storageFor(sessionStorage);
export const local = storageFor(localStorage);