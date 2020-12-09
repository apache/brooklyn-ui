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

const MODULE_NAME = 'brooklyn.composer.service.tab-service';

angular.module(MODULE_NAME, [])
    .provider('tabService', actionServiceProvider);

export default MODULE_NAME;

export function actionServiceProvider() {
    let tabs = {};
    return {
        $get: function () {
            return new TabService(tabs);
        },
        addTab(id, tab) {
            tabs[id] = tab;
        },
        deleteTab(id) {
            delete tabs[id];
        }
    }
}

class TabService {
    constructor(tabsToAdd) {
        this.tabs = [];
        this.requiredFields = ['title', 'stateKey'];

        for (const [id, tab] of Object.entries(tabsToAdd)) {
            this.addTab(id, tab);
        }
    }

    addTab(id, tab) {
        if (!id) {
            throw `ID for tab ${JSON.stringify(tab)} must ve a non-empty value`;
        }
        if (!tab) {
            throw `Tab "${id}" must be a valid object`;
        }
        this.requiredFields.forEach(field => {
            if (!tab[field]) {
                throw `Tab "${id}" must have a non-empty "${field}" property`;
            }
        });
        if (this.tabs.some(tab => tab.id === id)) {
            throw `Tab with "${id}" already exists`;
        }
        this.tabs.push(Object.assign({
            id: id,
            order: 0
        }, tab));
    }

    getTabs() {
        return this.tabs.sort((a, b) => a.order - b.order);
    }
}