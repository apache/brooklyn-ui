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
const MESSAGE = new WeakMap();
const GROUP = new WeakMap();
const PHASE = new WeakMap();
const REF = new WeakMap();
const LEVEL = new WeakMap();

export const ISSUE_LEVEL = {
    WARN: {
        id: 'warn',
        class: 'warn'
    },
    ERROR: {
        id: 'error',
        class: 'danger'
    }
};

export class Issue {
    constructor() {
        MESSAGE.set(this, '');
        GROUP.set(this, '');
        PHASE.set(this, '');
        REF.set(this, '');
        LEVEL.set(this, ISSUE_LEVEL.ERROR);
    }

    set message(message) {
        MESSAGE.set(this, message);
    }

    get message() {
        return MESSAGE.get(this);
    }

    set group(group) {
        GROUP.set(this, group);
    }

    get group() {
        return GROUP.get(this);
    }

    set phase(group) {
        PHASE.set(this, group);
    }

    get phase() {
        return PHASE.get(this);
    }

    set ref(ref) {
        REF.set(this, ref);
    }

    get ref() {
        return REF.get(this);
    }

    set level(level) {
        LEVEL.set(this, level);
    }

    get level() {
        return LEVEL.get(this);
    }

    static builder() {
        return new Builder();
    }
}

class Builder {
    constructor() {
        this.issue = new Issue();
    }

    message(message) {
        this.issue.message = message;
        return this;
    }

    group(group) {
        this.issue.group = group;
        return this;
    }

    phase(phase) {
        this.issue.phase = phase;
        return this;
    }

    ref(ref) {
        this.issue.ref = ref;
        return this;
    }

    level(level) {
        this.issue.level = level;
        return this;
    }

    build() {
        if (!this.issue.message || this.issue.message.length === 0) {
            throw new Error('Issue message is empty');
        }
        if (Object.keys(ISSUE_LEVEL).map(key=>ISSUE_LEVEL[key]).indexOf(this.issue.level) === -1) {
        // if (!Object.keys(ISSUE_LEVEL).map(key=>ISSUE_LEVEL[key]).contains(this.issue.level)) {
            throw new Error(`"${this.issue.level}" is not a valid issue level (available: [${Object.keys(ISSUE_LEVEL).map(key=>`ISSUES_LEVEL.${key}`).join(', ')}]`)
        }
        return this.issue;
    }
}
