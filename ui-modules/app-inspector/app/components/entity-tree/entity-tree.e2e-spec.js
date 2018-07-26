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
const request = require('request');

describe('Brooklyn UI App Inspector :: Entity tree', ()=> {
    browser.get('./');
    browser.waitForAngular();
    let apps = [];
    beforeEach((done)=> {
        request({method: 'GET', url: browser.baseUrl + '/v1/applications/fetch'}, (error, response, body)=> {
            expect(error).toBeNull();
            expect(response).not.toBeNull();
            expect(response.statusCode).toEqual(200);
            expect(body).not.toBeNull();
            apps = JSON.parse(body);
            done();
        })
    });
    waitForSpinnerToLeave();
    let applications = element.all(by.repeater('application in applications'));

    describe('Display', ()=> {

        it('should display the correct number of Applications', ()=> {
            expect(applications.count()).toBe(apps.length);
        });

        it('should display a chevron', ()=> {
            applications.map(function (application) {
                var toggleButton = application.element(by.className('entity-node-toggle'));
                expect(toggleButton.isDisplayed()).toBe(true);
            });
        });

        it('should not be open by default', ()=> {
            applications.map(function (application) {
                var childEntities = application.element(by.className('entity-node-children'));
                expect(childEntities.isDisplayed()).toBe(false);
            });
        });

        it('should show children when chevron is clicked', ()=> {
            applications.map(function (application) {
                var toggleButton = application.element(by.className('entity-node-toggle'));
                var childEntities = application.element(by.className('entity-node-children'));
                let childEntitiesDisplay = childEntities.isDisplayed();
                toggleButton.click();
                expect(childEntities.isDisplayed()).not.toBe(childEntitiesDisplay);
            });
        });

        it('should set active entity when clicked', ()=> {
            applications.map(function (application) {
                var entityName = application.element(by.className('entity-node-name'));
                var childEntities = application.element(by.className('entity-node-children'));
                let childEntitiesDisplay = childEntities.isDisplayed();

                entityName.click();
                expect(childEntities.isDisplayed()).not.toBe(childEntitiesDisplay);
                expect(application.getAttribute('class')).toContain('active');
            });

        });

        it('should open children when option clicked', ()=> {
            applications.map(function (application) {
                var childEntities = application.element(by.className('entity-node-children'));
                let childEntitiesDisplay = childEntities.isDisplayed();

                browser.actions()
                    .mouseMove(application)
                    .keyDown(protractor.Key.SHIFT)
                    .click()
                    .perform();
                expect(childEntities.isDisplayed()).not.toBe(childEntitiesDisplay);
                application.click();
            });

        });

    });

});


function waitForSpinnerToLeave() {
    var el = element(by.tagName('interstitial-spinner'));
    return browser.wait(function() {
        return el.isPresent().then(function(present) {
            return !present;
        })
    });
}
