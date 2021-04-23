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
            // TODO key should be a tuple of group, ref, message
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
            qfi.propose(issue, proposalHolder);
            // we could offer the fix per-issue, but no need as they can get that by navigating to the entity
            //qfi.propose(issue, issueO.quickFixes);  // issueO from previous method
        }
    });
}

const QUICK_FIX_PROPOSERS = {
    clear_config: {
        // the propose function updates the proposals object
        propose: (issue, proposals) => {
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
    set_from_parameter: {
        propose: (issue, proposals) => {}
      // - key: post_code
      //   fix: set_from_parameter
      //   message-regex: required
      //   source-mode: suggested
      //   source-hierarchy: root
      //   source-types: [ org.apache.brooklyn.api.entity.Application ]
      //   source-parameter: postal_code
      //   source-constraints:
      //   - required

    },
    set_from_config_key: {
        propose: (issue, proposals) => {}
        // - key: post_code
        //   fix: set_from_config_key
        //   message-regex: required
        //   source-mode: enforced
        //   source-types: [ basic-with-constraint ]
        //   source-key: post_code
        //   source-hierarchy: anywhere

    }
};

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