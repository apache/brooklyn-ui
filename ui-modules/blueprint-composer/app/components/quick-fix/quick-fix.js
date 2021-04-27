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


export function computeQuickFixes(allIssues) {
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

            computeQuickFixesForIssue(issue, issue.entity, v.quickFixes)
        });
    });
    return allIssues;
}

export function computeQuickFixesForIssue(issue, entity, proposalHolder) {
    let qfs = getQuickFixHintsForIssue(issue, entity);
    (qfs || []).forEach(qf => {
        let qfi = getQuickFixProposer(qf['fix']);
        if (!qfi) {
            console.log("Skipping unknown quick fix", qf);
        } else {
            qfi.propose(qf, issue, entity, proposalHolder);
            // we could offer the fix per-issue, but no need as they can get that by navigating to the entity
            //qfi.propose(issue, issueO.quickFixes);  // issueO from previous method
        }
    });
}

const QUICK_FIX_PROPOSERS = {
    clear_config: {
        // the propose function updates the proposals object
        propose: (qfdef, issue, entity, proposals) => {
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
    set_from_key: {
        propose: proposeSetFrom()
        // - key: post_code
        //   fix: set_from_key
        //   message-regex: required
        //
        //   source-key: postal_code    # required, custom
        //
        //   source-hierarchy: root     # optional, root|anywhere|ancestors -- default is root if no source-types given, anywhere if source-types are given
        //   source-types: [ org.apache.brooklyn.api.entity.Application ]     # types to filter by
        //
        //   source-key-createable: true         # whether a parameter can be created or a key/param must already exist there (default the latter, ie false)
        //   source-key-parameter-definition:    # if createable and did not exist, extra things to add to definition
        //     constraints:
        //     - required

        //   source-mode: suggested | enforced   # (enhancement, not supported) could allow user to pick the type and/or key/param name

    },
};

function proposeSetFrom() {
    return function (qfdef, issue, entity, proposals) {
        if (!issue.ref) return;

        let ckey = qfdef['source-key'];
        if (!ckey) {
            console.warn("Missing required 'source-key' on hint", qfdef);
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
                // TODO would be nice to store super-types of entity in miscData and filter based on those
                if (!qfdef['source-types'].includes(sourceNode.entity.type)) {
                    // wrong type
                    return;
                }
            }

            if (sourceNode.entity._id === entity._id && ckey === issue.ref) {
                // skip proposal for recursive definition
                return;
            }

            let hasKey = sourceNode.entity.config[ckey] || (sourceNode.entity.miscData.get("config") || []).find(c => c && c.name === ckey);
            let hasParam = sourceNode.entity.getParameterNamed(ckey);

            let existing = hasKey || hasParam;
            let create = !existing && createable;

            if (!existing && !create) {
                // no proposal available (cannot create)
                return;
            }

            sourceNode.id = sourceNode.id || sourceNode.entity.id || sourceNode.entity._id;
            sourceNode.name = sourceNode.name || sourceNode.entity.name ||
                ((sourceNode.entity.type || "Unnamed item") + " " + "(" + (sourceNode.entity.id || sourceNode.entity._id) +")");

            let pkey = 'set_from_' + sourceNode.id + '_' + ckey;
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
                        if (!sourceNode.entity.id) {
                            sourceNode.entity.id = sourceNode.entity._id;
                        }

                        entity = (entity || issue.entity);
                        entity.addConfig(issue.ref, '$brooklyn:component("' + sourceNode.entity.id + '").config("' + ckey + '")');
                    }
                });
            }
            if (proposals[pkey]) {
                proposals[pkey].issues.push(issue);
            }
        };

        if (qfdef['source-hierarchy']=='root' || (!qfdef['source-hierarchy'] && !qfdef['source-types'])) {
            considerNode({
                        id: 'root',
                        name: 'the application root node',
                        entity: entity.getApplication(),
                    });
        } else if (qfdef['source-hierarchy']=='anywhere' || (!qfdef['source-hierarchy'] && qfdef['source-types'])) {
            entity.getApplication().visitWithDescendants(entity => considerNode({ entity }));
        } else if (qfdef['source-hierarchy']=='ancestors') {
            entity.visitWithAncestors(entity => considerNode({ entity }));
        } else {
            console.warn("Unsupported source-hierarchy in quick-fix", qfdef);
        }

    };
}

export function getQuickFixProposer(type) {
    return QUICK_FIX_PROPOSERS[type];
}

export function getQuickFixHintsForIssue(issue, entity) {
    if (issue.group === 'config') {
        let hints = (entity.miscData.get('ui-composer-hints') || {})['config-quick-fixes'] || [];
        hints = hints.filter(h => h.key === issue.ref);
        if (!hints.length) return null;
        hints = hints.filter(h => !h['message-regex'] || new RegExp(h['message-regex']).test(issue.message));
        return hints;
    }
    return null;
}