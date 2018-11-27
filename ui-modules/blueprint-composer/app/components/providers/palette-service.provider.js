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

const MODULE_NAME = 'brooklyn.composer.service.palette';

angular.module(MODULE_NAME, [])
    .provider('paletteService', paletteServiceProvider);

export default MODULE_NAME;

export function paletteServiceProvider() {
    let sections = {};

    return {
        $get: function () {
            return new PaletteService(sections);
        },
        addSection(id, section) {
            sections[id] = section;
        },
        deleteSection(id) {
            let old = sections[id];
            delete sections[id];
            return old;
        }
    }
}

class PaletteService {
    constructor(sectionsToAdd) {
        this.sections = {};
        this.requiredFields = ['title', 'type', 'icon'];
        // 'mode' is optional

        for (const [id, section] of Object.entries(sectionsToAdd)) {
            this.addSection(id, section);
        }
    }

    addSection(id, section) {
        if (!section) {
            throw 'Section must be an object';
        }

        this.requiredFields.forEach(field => {
            if (!section.hasOwnProperty(field)) {
                throw `Section must have field "${field}" defined`;
            }
        });

        if (!id) {
            throw 'Action must have id defined';
        }
        this.sections[id] = section;
    }

    getSections() {
        return this.sections;
    }
}
