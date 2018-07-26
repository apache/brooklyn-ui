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
import {Issue, ISSUE_LEVEL} from './issue.model';

describe('Issue model', ()=> {
    it('can be instantiated correctly', ()=> {
        let issue = new Issue();
        expect(issue).toBeDefined();
        expect(issue.message).toBe('');
        expect(issue.group).toBe('');
        expect(issue.ref).toBe('');
        expect(issue.level).toBe(ISSUE_LEVEL.ERROR);
    });

    it('can be constructed correctly', ()=> {
        let message = 'Hello World!';
        let group = 'config';
        let ref = 'foo.bar';
        let level = ISSUE_LEVEL.WARN;

        let issue = Issue.builder().message(message).group(group).ref(ref).level(level).build();

        expect(issue).toBeDefined();
        expect(issue.message).toBe(message);
        expect(issue.group).toBe(group);
        expect(issue.ref).toBe(ref);
        expect(issue.level).toBe(level);
    });

    describe('with builder', ()=> {
        it('cannot instantiate and issue without message', ()=> {
            let exception;
            try {
                Issue.builder().build();
            } catch (ex) {
                exception = ex;
            }
            expect(exception).toBeDefined();
            expect(exception.message).toBe('Issue message is empty');
        });
        it('cannot instantiate and issue with invalid level', ()=> {
            let exception;
            let level = 'foo';
            try {
                Issue.builder().message('hello world').level(level).build();
            } catch (ex) {
                exception = ex;
            }
            expect(exception).toBeDefined();
            expect(exception.message).toMatch(`"${level}" is not a valid issue level`);
        });
    });
});