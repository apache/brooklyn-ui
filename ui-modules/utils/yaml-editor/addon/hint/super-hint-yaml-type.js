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
import CodeMirror from 'codemirror';
import jsyaml from 'js-yaml';
import {TypeProvider, TypeMatcher} from './type-matcher';

const typeMatcher = new TypeMatcher();
typeMatcher.registerProvider(new TypeProvider('/v1/catalog/types?supertype=entity&versions=latest', type => ['services', 'item', 'brooklyn.children', '$brooklyn.object'].indexOf(type) > -1));
typeMatcher.registerProvider(new TypeProvider('/v1/catalog/types?supertype=policy&versions=latest', type => ['brooklyn.policies', '$brooklyn.object'].indexOf(type) > -1));
typeMatcher.registerProvider(new TypeProvider('/v1/catalog/types?supertype=enricher&versions=latest', type => ['brooklyn.enrichers', 'brooklyn.initializers', '$brooklyn.object'].indexOf(type) > -1));
typeMatcher.registerProvider(new TypeProvider('/v1/catalog/locations', type => ['location', '$brooklyn.object'].indexOf(type) > -1));

CodeMirror.registerGlobalHelper('superHint', 'yamlType', mode => mode.name === 'yaml', (cm) => {
    return new Promise((resolve, reject) => {
        let cursor = cm.getCursor();
        let currentText = cm.getLine(cursor.line);

        let separatorMatch = currentText.match(/:\s+/);
        let isKey = separatorMatch === null || cursor.ch < separatorMatch['index'] + separatorMatch[0].length;

        let start = cursor.ch;
        while (start && !/\s/.test(currentText.charAt(start - 1))) {
            --start;
        }
        let keyword = currentText.slice(start, cursor.ch);

        let hints = {
            list: [],
            from: CodeMirror.Pos(cursor.line, start),
            to: cursor
        };

        if (isKey) {
            resolve(hints);
        } else {
            try {
                let json = jsyaml.safeLoad(cm.getRange(CodeMirror.Pos(0, 0), cursor));

                typeMatcher.findTypes(json).then(types => {
                    resolve(Object.assign(hints, {
                        list: types
                            .filter(type => keyword.length < 1 || type.symbolicName.indexOf(keyword) > -1)
                            .map(type => cm.superHint(type.symbolicName, type.displayName || type.symbolicName, type.symbolicName, type.description))
                    }));
                }).catch(ex => {
                    reject(new Error(`Cannot retrieve suggestions: ${ex.message}`));
                });
            } catch (ex) {
                resolve(hints);
            }
        }
    });
});
