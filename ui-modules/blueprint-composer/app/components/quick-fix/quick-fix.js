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

const MODULE_NAME = 'brooklyn.components.quick-fix.quick-fix';

angular.module(MODULE_NAME, []);

export default MODULE_NAME;


export function computeQuickFixes(blueprintService, allIssues) {
    if (!allIssues) allIssues = blueprintService.getAllIssues();
    if (!allIssues) allIssues = {};
    if (!allIssues.errors) allIssues.errors = {};

    allIssues.errors.byMessage = {};
    Object.values(allIssues.errors.byEntity).forEach(list => {
        list.forEach(issue => {
            let key = issue.group+":"+issue.ref+":"+issue.message;
            let v = allIssues.errors.byMessage[key];
            if (!v) {
                v = allIssues.errors.byMessage[key] = {
                    group: issue.group,
                    ref: issue.ref,
                    message: issue.message,
                    issues: [],
                    quickFixes: {},
                };
            }

            let issueO = {
                issue,
                //quickFixes: {},
            }
            v.issues.push(issueO);

            computeQuickFixesForIssue(issue, issue.entity, blueprintService, v.quickFixes)
        });
    });

    allIssues.warnings.byMessage = {};
    Object.values(allIssues.warnings.byEntity).forEach(list => {
        list.forEach(issue => {
            let key = issue.group+":"+issue.ref+":"+issue.message;
            let v = allIssues.warnings.byMessage[key];
            if (!v) {
                v = allIssues.warnings.byMessage[key] = {
                    group: issue.group,
                    ref: issue.ref,
                    message: issue.message,
                    issues: [],
                    quickFixes: {},
                };
            }

            let issueO = {
                issue,
                //quickFixes: {},
            }
            v.issues.push(issueO);

            computeQuickFixesForIssue(issue, issue.entity, blueprintService, v.quickFixes)
        });
    });
    return allIssues;
}

export function computeQuickFixesForIssue(issue, entity, blueprintService, proposalHolder) {
    let qfs = getQuickFixHintsForIssue(issue, entity);
    (qfs || []).forEach(qf => {
        let qfi = getQuickFixProposer(qf['fix']);
        if (!qfi) {
            console.log("Skipping unknown quick fix", qf);
        } else {
            qfi.propose(qf, issue, entity, blueprintService, proposalHolder);
            // we could offer the fix per-issue, but no need as they can get that by navigating to the entity
            //qfi.propose(issue, issueO.quickFixes);  // issueO from previous method
        }
    });
}

const QUICK_FIX_PROPOSERS = {
    clear_config: {
        // the propose function updates the proposals object
        propose: (qfdef, issue, entity, blueprintService, proposals) => {
            if (!issue.ref) return;
            if (!proposals) proposals = {};

            if (!proposals.clear_config) {
                proposals.clear_config = {
                    text: "Remove value",
                    tooltip: "This will clear the value currently set for config \""+issue.ref+"\".",
                    apply: (issue, entity) => (entity || issue.entity).removeConfig(issue.ref),
                    issues: [],
                };
            }
            proposals.clear_config.issues.push(issue);
        },
    },
    explicit_config: {
        propose: (qfdef, issue, entity, blueprintService, proposals) => {
            if (!issue.ref) {
                return;
            }
            if (!proposals) {
                proposals = {};
            }

            if (!proposals.explicit_config) {
                let entityToReference = (entity || issue.entity).parent;
                let scopeRootOrComponent =  blueprintService.get() === entityToReference ? 'scopeRoot()' : `component("${entityToReference.id}")`;
                console.log('scopeRootOrComponent', scopeRootOrComponent)
                proposals.explicit_config = {
                    text: 'Set explicit config from parent',
                    tooltip: `This will set the config "${issue.ref}" to its parent value, explicitly`,
                    apply: (issue, entity) => (entity || issue.entity).addConfig(issue.ref, `$brooklyn:${scopeRootOrComponent}.config("${issue.ref}")`),
                    issues: []
                };
            }
            proposals.explicit_config.issues.push(issue);
        }
    },
    set_from_key: {
        propose: proposeSetFromKey()
        // - key: post_code
        //   fix: set_from_key
        //   message-regex: required
        //
        //   source-key: postal_code    # one of these is required
        //   source-key-regex: ^postal_code($|_.*)
        //
        //   source-hierarchy: root     # optional, root|anywhere|ancestors -- default is root if no source-types given, anywhere if source-types are given
        //   source-types: [ org.apache.brooklyn.api.entity.Application ]     # types to filter by
        //
        //   source-key-createable: true         # whether a parameter can be created or a key/param must already exist there (default the latter, ie false)
        //   source-key-parameter-definition:    # if createable and did not exist, extra things to add to definition
        //     constraints:
        //     - required
    },
    set_from_template: {
        propose: proposeSetFromTemplate(),
        // - key: post_code
        //   fix: set_from_template
        //   message-regex: required
        //   template: ${application}-${entity}  # required, the template, supporting vars application, application.id, entity, entity.name, entity._id
        //   preview: "Set post_code '${application}_<entity_name_or_id>'"         # optional, summary for button, grouping fixes, and filtering (template rules applied to this, skipped if not applicable)
        //   sanitize: _                         # optional, sanitize as specified, eg _ or - or '.' to replace non-alphanumeric chars with that
    }
};

function proposeSetFromKey() {
    return function (qfdef, issue, entity, blueprintService, proposals) {
        if (!issue.ref) return;

        let ckey_exact = qfdef['source-key'];
        let ckey_regex = qfdef['source-key-regex'];
        if (!ckey_exact && !ckey_regex) {
            console.warn("Missing at least one of 'source-key' or 'source-key-regex' on hint", qfdef);
            return;
        }

        if (!proposals) proposals = {};

        let createable = qfdef['source-key-createable'];

        // TODO make default id contain type name
        // TODO show default id if no id present

        // TODO if id is changed, update all refs
        // TODO allow graphically selectable

        let considerNode = (sourceNode) => {
            if (qfdef['source-types']) {
                if (!qfdef['source-types'].includes(sourceNode.entity.type)) {
                    // wrong type; check traits (supertypes)
                    if ((sourceNode.entity.miscData.get("traits") || []).find(t => qfdef['source-types'].includes(t))) {
                        // there was a super-type which matched; we're okay
                    } else {
                        // also no supertype matches the specified source-types, so don't make a proposal for this node
                        return;
                    }
                }
            }

            let contenders = {};
            if (ckey_exact) {
                let exactKey = sourceNode.entity.config[ckey_exact] || (sourceNode.entity.miscData.get("config") || []).find(c => c.name === ckey_exact);
                // don't think we need to check params -- sourceNode.entity.getParameterNamed(ckey) -- as they should be in config

                if (exactKey) contenders[ckey_exact] = true;
            }
            let create = !Object.keys(contenders).length && createable && ckey_exact;
            if (create) {
                contenders[ckey_exact] = true;
            }

            if (ckey_regex) {
                let r = new RegExp(ckey_regex);
                Object.keys(sourceNode.entity.config).forEach(k => {
                    if (r.test(k)) contenders[k] = true;
                });
                (sourceNode.entity.miscData.get("config") || []).forEach(c => {
                    if (r.test(c.name)) contenders[c.name] = true;
                });
            }

            if (!Object.keys(contenders).length) {
                // no proposal available (cannot create)
                return;
            }

            if (!sourceNode.entity.parent) {
                sourceNode.id = sourceNode.id || 'root';
                sourceNode.name = sourceNode.name || sourceNode.entity.name || 'the application root node';
            }

            sourceNode.id = sourceNode.id || sourceNode.entity.id || sourceNode.entity._id;
            sourceNode.name = sourceNode.name || sourceNode.entity.name ||
                ((sourceNode.entity.type || "Unnamed item") + " " + "(" + (sourceNode.entity.id || sourceNode.entity._id) + ")");

            Object.keys(contenders).forEach(ckey => {
                if (sourceNode.entity._id === entity._id && ckey === issue.ref) {
                    // skip proposal for recursive definition
                    return;
                }

                let pkey = 'set_from_key_' + sourceNode.id + '_' + ckey;
                if (!proposals[pkey]) {
                    if (create) {
                        proposals[pkey] = {
                            text: "Set from new parameter '" + ckey + "' on " + sourceNode.name,
                            tooltip: "This will fix the error by setting the value here equal to the value of a new parameter '" + ckey + "' created on " + sourceNode.name
                                + ". The value of that parameter may need to be set in order to deploy this.",
                        };
                    } else {
                        proposals[pkey] = {
                            text: "Set from '" + ckey + "' on " + sourceNode.name,
                            tooltip: "This will fix the error by setting the value here equal to the value of " +
                                sourceNode.target_mode +
                                " '" + ckey + "' on " + sourceNode.name,
                        };
                    }

                    Object.assign(proposals[pkey], {
                        issues: [],
                        apply: (issue, entity) => {
                            if (create) {
                                // check again so we only create once
                                let hasParam = sourceNode.entity.getParameterNamed(ckey);
                                if (!hasParam) {
                                    sourceNode.entity.addParameterDefinition(Object.assign(
                                        {name: ckey,},
                                        qfdef['source-key-parameter-definition'],
                                    ));
                                }
                            }
                            blueprintService.populateId(sourceNode.entity);

                            entity = (entity || issue.entity);
                            entity.addConfig(issue.ref, '$brooklyn:component("' + sourceNode.entity.id + '").config("' + ckey + '")');
                        }
                    });
                }
                if (proposals[pkey]) {
                    proposals[pkey].issues.push(issue);
                }
            });
        }

        if (qfdef['source-hierarchy']=='root' || (!qfdef['source-hierarchy'] && !qfdef['source-types'])) {
            considerNode({ entity: entity.getApplication() });
        } else if (qfdef['source-hierarchy']=='anywhere' || (!qfdef['source-hierarchy'] && qfdef['source-types'])) {
            entity.getApplication().visitWithDescendants(entity => considerNode({ entity }));
        } else if (qfdef['source-hierarchy']=='ancestors') {
            entity.visitWithAncestors(entity => considerNode({ entity }));
        } else {
            console.warn("Unsupported source-hierarchy in quick-fix", qfdef);
        }

    };
}

function proposeSetFromTemplate() {
    return function (qfdef, issue, entity, blueprintService, proposals) {
        if (!issue.ref) return;

        let template = qfdef['template'];
        if (!template) {
            console.warn("Missing 'template' on hint", qfdef);
            return;
        }

        let sanitize = qfdef['sanitize'];
        let sanitizeFn = s => {
            if (!sanitize) return s;
            return s.replace(/\W+/g, sanitize);
        }

        if (!proposals) proposals = {};

        function replace(s, keyword, fn, skipSanitize) {
            if (!s) return null;
            let p = "${"+keyword+"}";
            if (s.includes(p)) {
                let v = fn();
                if (v) {
                    if (!skipSanitize) v = sanitizeFn(v);
                    do {
                        s = s.replace(p, v);
                    } while (s.includes(p));
                } else {
                    return null;
                }
            }
            return s;
        }

        function replaceTemplate(result, s, x, idFn, isPreview) {
            let idLastFn = () => {
                let last = x.id;
                let takeLast = last || !isPreview;
                last = last || idFn(s,x);
                if (takeLast) last = last.replace(/^.*\W+(\w+\W*)/, '$1');
                return last;
            };
            result = replace(result, s, () => x.name || idLastFn(), isPreview && !x.name && !x.id);
            result = replace(result, s+".name", () => x.name);
            result = replace(result, s+".nameOrType", () => x.name || x.miscData.get('typeName') || x.type);
            result = replace(result, s+".typeName", () => x.miscData.get('typeName') || x.type);
            result = replace(result, s+".type", () => x.type || x.miscData.get('typeName'));
            result = replace(result, s+".id", () => x.id || idFn(s,x));
            // takes the last word of the ID
            result = replace(result, s+".idLast", idLastFn, isPreview);
            result = replace(result, s+"._id", () => x._id);
            return result;
        }

        let idFnForPreview = (s,x) => "<"+s+" ID, changed from "+x._id+">";
        let preview = qfdef['preview'] || "Set '"+template+"'";
        preview = replaceTemplate(preview, "entity", entity, idFnForPreview, true);
        preview = replaceTemplate(preview, "application", entity.getApplication(), idFnForPreview, true);

        if (preview) {
            let pkey = 'set_from_template_' + preview;
            if (!proposals[pkey]) {
                proposals[pkey] = {
                    text: preview,
                    tooltip: "This will fix the error by setting the value here based on a template." +
                        (sanitize ? " The result will be sanitized using '" + sanitize + "'." : ""),
                };

                Object.assign(proposals[pkey], {
                    issues: [],
                    apply: (issue, entity) => {
                        entity = (entity || issue.entity);
                        let result = template;
                        let idFnForActual = (s, x) => {
                            blueprintService.populateId(x);
                            return x.id;
                        };
                        result = replaceTemplate(result, "entity", entity, idFnForActual);
                        result = replaceTemplate(result, "application", entity.getApplication(), idFnForActual);
                        if (!result) {
                            console.warn("Could not apply quick fix: template '"+template+"' not valid at entity", entity);
                        } else {
                            entity.addConfig(issue.ref, result);
                        }
                    }
                });
            }
            if (proposals[pkey]) {
                proposals[pkey].issues.push(issue);
            }
        }

    };
}

export function getQuickFixProposer(type) {
    return QUICK_FIX_PROPOSERS[type];
}

export function getQuickFixHintsForIssue(issue, entity) {
    if (issue.group === 'config') {
        let hints = (entity.miscData.get('ui-composer-hints') || {})['config-quick-fixes'] || [];
        hints = hints.filter(h => new RegExp(h.key).test(issue.ref));
        if (!hints.length) return null;
        hints = hints.filter(h => !h['message-regex'] || new RegExp(h['message-regex']).test(issue.message));
        return hints;
    }
    return null;
}