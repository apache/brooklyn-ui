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
import {SchemaMatcher} from './schema-matcher';
import blueprintSchema from '../schemas/blueprint.json';
import blueprintEntitySchema from '../schemas/blueprint-entity.json';
import blueprintLocationSchema from '../schemas/blueprint-location.json';
import catalogSchema from '../schemas/catalog.json';
import catalogItemReferenceSchema from '../schemas/catalog-item-reference.json';
import catalogItemInlineSchema from '../schemas/catalog-item-inline.json';
import catalogVersionSchema from '../schemas/catalog-version.json';
import rootSchema from '../schemas/root.json';

CodeMirror.registerGlobalHelper('superHint', 'yamlBlueprint', (mode, cm) => (mode.name === 'yaml' && mode.type === 'blueprint'), (cm, options) => {
    let schemaMatcher = new SchemaMatcher();

    schemaMatcher.registerSchema(JSON.parse(blueprintSchema));
    schemaMatcher.registerSchema(JSON.parse(blueprintEntitySchema));
    schemaMatcher.registerSchema(JSON.parse(blueprintLocationSchema));

    return superHint(schemaMatcher, blueprintSchema, cm, options);
});
CodeMirror.registerGlobalHelper('superHint', 'yamlCatalog', (mode, cm) => (mode.name === 'yaml' && mode.type === 'catalog'), (cm, options) => {
    let schemaMatcher = new SchemaMatcher();

    schemaMatcher.registerSchema(JSON.parse(catalogSchema));
    schemaMatcher.registerSchema(JSON.parse(catalogItemReferenceSchema));
    schemaMatcher.registerSchema(JSON.parse(catalogItemInlineSchema));
    schemaMatcher.registerSchema(JSON.parse(catalogVersionSchema));

    return superHint(schemaMatcher, catalogSchema, cm, options);
});
CodeMirror.registerGlobalHelper('superHint', 'yamlBrooklyn', (mode, cm) => (mode.name === 'yaml' && mode.type === 'brooklyn'), (cm, options) => {
    let schemaMatcher = new SchemaMatcher();

    schemaMatcher.registerSchema(JSON.parse(blueprintSchema));
    schemaMatcher.registerSchema(JSON.parse(blueprintEntitySchema));
    schemaMatcher.registerSchema(JSON.parse(blueprintLocationSchema));
    schemaMatcher.registerSchema(JSON.parse(catalogSchema));
    schemaMatcher.registerSchema(JSON.parse(catalogItemReferenceSchema));
    schemaMatcher.registerSchema(JSON.parse(catalogItemInlineSchema));
    schemaMatcher.registerSchema(JSON.parse(catalogVersionSchema));

    return superHint(schemaMatcher, rootSchema, cm, options);
});

function superHint(schemaMatcher, baseSchema, cm, options) {
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

        if (!isKey) {
            resolve(hints);
        } else {
            try {
                let levels = new Set();
                let cursor = cm.getCursor();
                let line = cursor.line;
                let prevLine = cursor.line > 0 ? cursor.line - 1 : 0;

                while (!levels.has(0) && line > 0) {
                    levels.add(cm.getLine(line).match(/^([\s\-]*)/)[1].length);
                    line--;
                }

                levels = Array.from(levels).sort((a, b) => (a - b));

                let level = cm.getRange(CodeMirror.Pos(cursor.line, 0), cursor).match(/^([\s\-]*)/)[1].length;
                if (levels.indexOf(level) > -1) {
                    level = levels.indexOf(level);
                }
                let json = jsyaml.safeLoad(cm.getRange(CodeMirror.Pos(0, 0), CodeMirror.Pos(prevLine, cm.getLine(prevLine).length)));

                schemaMatcher.findProperties(json, JSON.parse(baseSchema), level).then(properties => {
                    resolve(Object.assign(hints, {
                        list: properties
                            .filter(property => keyword.length < 1 || property.$key.indexOf(keyword) > -1)
                            .map(property => {
                                let helper = ['pattern', 'minItems', 'maxItems', 'enum'].reduce((helper, prop) => {
                                    if (property.hasOwnProperty(prop)) {
                                        helper.push(`${prop}: ${property[prop]}`);
                                    }
                                    return helper;
                                }, []).join(';');
                                return cm.superHint(`${property.$key}: `, property.$key, `(${property.type}) ${helper}`, property.description);
                            })
                    }));
                }).catch(ex => {
                    reject(new Error(`Cannot retrieve suggestions: ${ex.message}`));
                });
            } catch (ex) {
                resolve(hints);
            }
        }
    });
}
