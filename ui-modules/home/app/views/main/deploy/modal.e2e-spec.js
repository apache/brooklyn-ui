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


describe('modal', ()=> {
    var id, version, app;
    beforeEach((done)=> {
        id = Math.random().toString(36).slice(2);
        version = Date.now();
        request({
            method: 'POST',
            url: browser.baseUrl + '/v1/catalog',
            body: generateTestCatalogApp(id, version)
        }, (error, response, body)=> {
            expect(error).toBeNull();
            expect(response).not.toBeNull();
            expect(response.statusCode).toEqual(201);
            expect(body).not.toBeNull();
            app = JSON.parse(body)[id + ':' + version];
            done();
        });
    });
    afterEach((done)=> {
        request({
            method: 'DELETE',
            url: browser.baseUrl + '/v1/catalog/applications/' + app.symbolicName + '/' + app.version + '?id=' + app.id
        }, ()=> (done()));
    });


    it('should display the catalog application correctly', ()=> {
        var quickLaunch = openModal().element(by.css('quick-launch'));
        expect(quickLaunch.element(by.css('h3.quick-launch-title')).getText()).toBe('Deploy');
        expect(quickLaunch.element(by.css('div.quick-launch-type h4.media-heading')).getText()).toEqual(id);
        expect(quickLaunch.element(by.css('div.quick-launch-type p.media-subheading')).getText()).toEqual(version + '');
        expect(quickLaunch.element(by.css('section.quick-launch-name input')).getAttribute('placeholder')).toEqual('Choose a name for this application (Optional)');
        expect(quickLaunch.element(by.css('section.quick-launch-name input')).getAttribute('valie')).toBeNull();
        expect(quickLaunch.element(by.css('section.quick-launch-location input')).getAttribute('placeholder')).toEqual('Select a location where to deploy this application');
        expect(quickLaunch.element(by.css('section.quick-launch-location input')).getAttribute('value')).toBe('');

        expect(quickLaunch.element(by.css('div.quick-launch-actions button.btn-default')).getText()).toEqual('Open in Editor');
        expect(quickLaunch.element(by.css('div.quick-launch-actions button.btn-success')).getText()).toEqual('Deploy');
        expect(quickLaunch.element(by.css('div.quick-launch-actions button.btn-success')).getAttribute('disabled')).toEqual('true');
    });
    it('should be able to edit the raw yaml', ()=> {
        var quickLaunch = openModal().element(by.css('quick-launch'));
        expect(quickLaunch.element(by.css('yaml-editor')).isDisplayed()).toBe(false);
        quickLaunch.element(by.css('div.quick-launch-actions button.btn-default')).click();
        expect(quickLaunch.element(by.css('yaml-editor')).isDisplayed()).toBe(true);
    });


    function openModal() {
        browser.get('./');
        browser.waitForAngular();
        var searchBar = element(by.css('fieldset div.form-group input.form-control'));
        expect(searchBar.isDisplayed()).toBe(true);
        searchBar.sendKeys(id);
        expect(element.all(by.repeater('app in filteredApps')).count()).toBe(1);
        element(by.repeater('app in filteredApps').row(0)).element(by.css('a.thumbnail')).click();
        browser.waitForAngular();
        var modal = element(by.css('div.modal.quick-launch-modal'));
        expect(modal.isDisplayed()).toBe(true);
        return modal;
    };
});

function generateTestCatalogApp(id, version) {
    return '' +
        'brooklyn.catalog:\n' +
        '  version: ' + version + '\n' +
        '  items:\n' +
        '  - id: ' + id + '\n' +
        '    itemType: template\n' +
        '    name: ' + id + '\n' +
        '    item:\n' +
        '      brooklyn.parameters:\n' +
        '      - name: number.param.with.default\n' +
        '        label: Number Param With Default\n' +
        '        type: integer\n' +
        '        default: 2\n' +
        '      - name: bool.param.with.default.true\n' +
        '        label: Bool Param With Default True\n' +
        '        type: boolean\n' +
        '        default: true\n' +
        '      - name: bool.param.with.default.false\n' +
        '        label: Bool Param With Default False\n' +
        '        type: boolean\n' +
        '        default: false\n' +
        '      - name: string.param.with.default\n' +
        '        label: String Param With Default\n' +
        '        type: string\n' +
        '        default: ' + id + id + '\n' +
        '      - name: number.param\n' +
        '        label: Number Param\n' +
        '        type: integer\n' +
        '      - name: bool.param\n' +
        '        label: Bool Param\n' +
        '        type: boolean\n' +
        '      - name: string.param\n' +
        '        label: String Param\n' +
        '        type: string\n' +
        '      services:\n' +
        '      - type: org.apache.brooklyn.entity.software.base.EmptySoftwareProcess';
}


