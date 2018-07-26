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
describe('Brooklyn brooklyn-ui-groovy :: groovyview view', ()=> {
    let EC = protractor.ExpectedConditions;
    let appLoadCondition = EC.stalenessOf(element(by.tagName('interstitial-spinner')));

    describe('should do', ()=> {
        browser.get('./');
        browser.waitForAngular();
        browser.wait(appLoadCondition, 5000);

        it('something really useful', ()=> {
            // This is an example of e2e test. It uses jasmine (http://jasmine.github.io/) syntax to define all tests to run.
        });
    })
});
