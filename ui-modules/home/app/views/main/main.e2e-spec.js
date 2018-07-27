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

describe('Brooklyn UI Home :: Main View', ()=> {
    browser.get('./');
    browser.waitForAngular();
    let apps = [], modules = [], locations = [];
    beforeEach((done)=> {
        request({method: 'GET', url: browser.baseUrl + '/v1/catalog/applications'}, (error, response, body)=> {
            expect(error).toBeNull();
            expect(response).not.toBeNull();
            expect(response.statusCode).toEqual(200);
            expect(body).not.toBeNull();
            apps = JSON.parse(body);
            done();
        })
    });
    beforeEach((done)=> {
        request({method: 'GET', url: browser.baseUrl + '/v1/locations'}, (error, response, body)=> {
            expect(error).toBeNull();
            expect(response).not.toBeNull();
            expect(response.statusCode).toEqual(200);
            expect(body).not.toBeNull();
            locations = JSON.parse(body);
            done();
        })
    });
    beforeEach((done)=> {
        request({method: 'GET', url: browser.baseUrl + '/v1/ui-module-registry'}, (error, response, body)=> {
            expect(error).toBeNull();
            expect(response).not.toBeNull();
            expect(response.statusCode).toEqual(200);
            expect(body).not.toBeNull();
            modules = JSON.parse(body);
            done();
        })
    });


    describe('Quick Launch', ()=> {
        it('should be paginated correctly', ()=> {
            expect(element(by.css('li.pagination-prev')).isDisplayed()).toBe(false);
            if (apps.length > 6) {
                expect(element.all(by.css('.quick-launch-item')).count()).toBe(6);
                expect(element(by.css('li.pagination-next')).isDisplayed()).toBe(true);
                element(by.css('li.pagination-next a')).click();
                expect(element(by.css('li.pagination-next')).isDisplayed()).toBe(apps.length > 12);
                expect(element(by.css('li.pagination-prev')).isDisplayed()).toBe(true);
            } else {
                expect(element.all(by.css('.quick-launch-item')).count()).toBe(apps.length);
            }
        });
    });

    describe('First launch', ()=> {
        it('should prompt the user to create a location if no locations registered', ()=> {
            var onboardingLocator = by.css('div.onboarding-card.brooklyn-home-card');
            if (locations.length === 0) {
                let onboardingCard = element(onboardingLocator);
                let link = onboardingCard.element(by.css('.card-actions a'));
                expect(link.isDisplayed()).toBe(true);
                expect(link.getAttribute('href')).toMatch(/^http[s]?:\/\/.*\/brooklyn-ui-location-manager\/#\/wizard$/);
                expect(link.getText()).toEqual('Create your first location');
            } else {
                expect(browser.isElementPresent(onboardingLocator)).toBe(false);
            }
        })
    });

    describe('UI Modules', ()=> {
        it('should display the correct number of UI modules', ()=> {
            expect(element.all(by.repeater('uiModule in vm.uiModules')).count()).toBe(modules.length);
        });
        it('should be displaying the module correctly', ()=> {
            modules.forEach((module)=> {
                let moduleLink = element(by.xpath('//a[@href="' + module.path + '"]'));
                expect(moduleLink.isDisplayed()).toBe(true);
                expect(moduleLink.element(by.css('i.module-icon.fa.' + module.icon.replace(/\s/g, '.'))).isDisplayed()).toBe(true);
                let moduleTitle = moduleLink.element(by.css('p.md-subhead h3'));
                expect(moduleTitle.isDisplayed()).toBe(true);
                expect(moduleTitle.getText()).toEqual(module.name)
            });
        });
    });


    describe('Brooklyn UI Home', ()=> {
        it('should have a title', ()=> {
            expect(browser.getTitle()).toEqual('Brooklyn - Home');
        });
        describe('should have a navbar', ()=> {
            var rootLink, links;
            beforeEach(()=> {
                rootLink = element.all(by.css('nav a.navbar-brand')).get(0);
                links = element.all(by.css('nav ul.nav.navbar-nav li a'));
            });

            describe('that has', ()=> {
                it('a link to the module root on the top left', ()=> {
                    browser.getCurrentUrl().then((url)=> {
                        rootLink.getAttribute('href').then((attr)=> {
                            expect(attr).toBe(url.slice(0, -2) + '#!/');
                        });
                    });
                });
                it('1 link on the top right', ()=> {
                    expect(links.count()).toBe(1);
                });
            });
        });
    });
});
