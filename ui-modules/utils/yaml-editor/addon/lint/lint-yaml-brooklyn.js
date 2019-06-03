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
import {YAMLException} from 'js-yaml';
import {JsYamlParser} from '../../JsYamlParser';
import {Validator} from 'jsonschema';
import blueprintSchema from '../schemas/blueprint.json';
import blueprintEntitySchema from '../schemas/blueprint-entity.json';
import blueprintLocationSchema from '../schemas/blueprint-location.json';
import catalogSchema from '../schemas/catalog.json';
import catalogItemReferenceSchema from '../schemas/catalog-item-reference.json';
import catalogItemInlineSchema from '../schemas/catalog-item-inline.json';
import catalogVersionSchema from '../schemas/catalog-version.json';
import rootSchema from '../schemas/root.json';

CodeMirror.registerGlobalHelper('lint', 'yamlBlueprint', (mode, cm) => (mode.name === 'yaml' && mode.type === 'blueprint'), (text, options, cm) => {
    let validator = new Validator();

    validator.addSchema(JSON.parse(blueprintSchema), '/Blueprint');
    validator.addSchema(JSON.parse(blueprintEntitySchema), '/Blueprint/Entity');
    validator.addSchema(JSON.parse(blueprintLocationSchema), '/Blueprint/Location');

    return lint(validator, blueprintSchema, text, options, cm);
});
CodeMirror.registerGlobalHelper('lint', 'yamlCatalog', (mode, cm) => (mode.name === 'yaml' && mode.type === 'catalog'), (text, options, cm) => {
    let validator = new Validator();

    validator.addSchema(JSON.parse(catalogSchema), '/Catalog');
    validator.addSchema(JSON.parse(catalogItemReferenceSchema), '/Catalog/Item/Reference');
    validator.addSchema(JSON.parse(catalogItemInlineSchema), '/Catalog/Item/Inline');
    validator.addSchema(JSON.parse(catalogVersionSchema), '/Catalog/Version');

    return lint(validator, catalogSchema, text, options, cm);
});
CodeMirror.registerGlobalHelper('lint', 'yamlBrooklyn', (mode, cm) => (mode.name === 'yaml' && mode.type === 'brooklyn'), (text, options, cm) => {
    let validator = new Validator();

    validator.addSchema(JSON.parse(blueprintSchema), '/Blueprint');
    validator.addSchema(JSON.parse(blueprintEntitySchema), '/Blueprint/Entity');
    validator.addSchema(JSON.parse(blueprintLocationSchema), '/Blueprint/Location');
    validator.addSchema(JSON.parse(catalogSchema), '/Catalog');
    validator.addSchema(JSON.parse(catalogItemReferenceSchema), '/Catalog/Item/Reference');
    validator.addSchema(JSON.parse(catalogItemInlineSchema), '/Catalog/Item/Inline');
    validator.addSchema(JSON.parse(catalogVersionSchema), '/Catalog/Version');

    return lint(validator, rootSchema, text, options, cm);
});

function lint(validator, baseSchema, text, options, cm) {
    let issues = [];
    let parser = new JsYamlParser();

    try {
        let root = parser.parse(text);

        if (root) {
            validator.validate(root.result, JSON.parse(baseSchema), {propertyName: 'blueprint', nestedErrors: true}).errors.forEach(error => {
                let from = CodeMirror.Pos(0, 0);
                let to = CodeMirror.Pos(0, 0);
                let yamlNode = findYamlNode(root, error.instance);

                if (yamlNode) {
                    switch (error.name) {
                        case 'anyOf':
                        case 'oneOf':
                        case 'allOf':
                        case 'not':
                        case 'required':
                            from = to = getPostFromIndex(yamlNode.start, cm);
                            break;
                        case 'additionalProperties':
                            let childNode = yamlNode.children.find(child => child.result === error.argument);
                            from = getPostFromIndex(childNode.start, cm);
                            to = getPostFromIndex(childNode.end, cm);
                            break;
                        default:
                            from = getPostFromIndex(yamlNode.start, cm);
                            to = getPostFromIndex(yamlNode.end, cm);
                            break;
                    }
                }
                issues.push({
                    from: from,
                    to: to,
                    message: error.stack
                });
            });
        }
    } catch (err) {
        if (err instanceof YAMLException) {
            // Inspire by the Mark.getSnippet() code: https://github.com/nodeca/js-yaml/blob/master/lib/js-yaml/mark.js#L16-L52
            let start = err.mark.position;
            while (start > 0 && '\x00\r\n\x85\u2028\u2029'.indexOf(err.mark.buffer.charAt(start - 1)) === -1) {
                start--;
            }
            let end = err.mark.position - start;
            let errorText = err.mark.buffer.substr(start, end);

            issues.push({
                from: CodeMirror.Pos(err.mark.line, cm.getLine(err.mark.line - 1).indexOf(errorText)),
                to: CodeMirror.Pos(err.mark.line, cm.getLine(err.mark.line - 1).indexOf(errorText) + (errorText.length > 0 ? errorText.length : 1)),
                message: err.reason
            });
        } else {
            issues.push({
                from: CodeMirror.Pos(0, 0),
                to: CodeMirror.Pos(0, 0),
                message: err.message
            });
        }
    }

    return issues;
}

function findYamlNode(node, search) {
    if (node.result === search) {
        return node;
    }

    for (let i = 0; i < node.children.length; i++) {
        let found = findYamlNode(node.children[i], search);
        if (found) {
            return found;
        }
    }
}

function getPostFromIndex(index, cm) {
    let total = cm.lineCount(), pos = 0, line, ch, len;
    for (line = 0; line < total; line++) {
        len = cm.getLine(line).length + 1;
        if (pos + len > index) { ch = index - pos; break; }
        pos += len;
    }
    return CodeMirror.Pos(line, ch);
}