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
import {TypeProvider, TypeMatcher} from './type-matcher';

describe('Class TypeProvider', ()=> {
    describe('match() method', () => {
        it('invokes the callback specified on the constructor with last item', ()=> {
            let spy = {
                match: () => {}
            };

            spyOn(spy, 'match');

            new TypeProvider('/foo/bar', spy.match).match(['foo', 0, 'bar', 2, 5, 'hello']);

            expect(spy.match).toHaveBeenCalledWith('hello');
        });
    });

    describe('get() method', () => {
        let url = '/foo/bar';
        let provider;

        beforeEach(function() {
            jasmine.Ajax.install();
            provider = new TypeProvider(url, function() {});
        });

        afterEach(function() {
            jasmine.Ajax.uninstall();
        });

        it('rejects the promise if the response cannot be parsed', (done) => {
            jasmine.Ajax.stubRequest(url).andReturn({
                'responseText': '{"foo": notQuotedValue}'
            });

            provider.get().then(() => {
                done.fail('Promise has been resolved');
            }).catch((ex) => {
                expect(ex instanceof SyntaxError).toBeTruthy();
                done();
            });
        });
        it('rejects the promise if the response returns a status code different that 200', (done) => {
            let status = 404;

            jasmine.Ajax.stubRequest(url).andReturn({
                'status': status,
                'responseText': '{"foo": "bar"}'
            });

            provider.get().then(() => {
                done.fail('Promise has been resolved');
            }).catch((ex) => {
                expect(ex instanceof Error).toBeTruthy();
                expect(ex.message).toEqual(`Request with endpoint "${url} returned an HTTP code of ${status}`);
                done();
            });
        });
        it('rejects the promise if there is a network error', (done) => {
            jasmine.Ajax.stubRequest(url).andError();

            provider.get().then(() => {
                done.fail('Promise has been resolved');
            }).catch((ex) => {
                expect(ex instanceof Error).toBeTruthy();
                expect(ex.message).toEqual(`Endpoint "${url} cannot be reached`);
                done();
            });
        });

        it('resolves the promise with the response from the associated ajax request', (done)=> {
            let jsonReponse = {foo: 'bar'};

            jasmine.Ajax.stubRequest(url).andReturn({
                'responseText': JSON.stringify(jsonReponse)
            });

            provider.get().then((response) => {
                expect(response).toEqual(jsonReponse);
                expect(jasmine.Ajax.requests.count()).toEqual(1);
                expect(jasmine.Ajax.requests.mostRecent().url).toEqual(url);
                done();
            }).catch(() => {
                done.fail('Promise has been rejected');
            });
        });
        it('resolves the promise with the cached response from the associated ajax request', (done) => {
            let jsonReponse = {foo: 'bar'};

            jasmine.Ajax.stubRequest('/foo/bar').andReturn({
                'responseText': JSON.stringify(jsonReponse)
            });

            provider.get().then((response) => {
                expect(response).toEqual(jsonReponse);
                expect(jasmine.Ajax.requests.count()).toEqual(1);
                expect(jasmine.Ajax.requests.mostRecent().url).toEqual(url);

                return provider.get();
            }).then((response) => {
                expect(response).toEqual(jsonReponse);
                expect(jasmine.Ajax.requests.count()).toEqual(1);
                expect(jasmine.Ajax.requests.mostRecent().url).toEqual(url);
                done();
            }).catch(() => {
                done.fail('Promise has been rejected');
            })
        });
    });
});

describe('Class TypeMatcher', ()=> {
    let typeMatcher;
    let fooProvider;
    let barProvider;

    beforeEach(function() {
        jasmine.Ajax.install();
        typeMatcher = new TypeMatcher();
        fooProvider = new TypeProvider('/foo', search => search === 'foo');
        barProvider = new TypeProvider('/bar', search => search === 'bar');
        typeMatcher.registerProvider(fooProvider);
        typeMatcher.registerProvider(barProvider);

        jasmine.Ajax.stubRequest('/foo').andReturn({
            responseText: JSON.stringify(['foo', 'bar'])
        });
        jasmine.Ajax.stubRequest('/bar').andReturn({
            responseText: JSON.stringify(['hello', 'world'])
        });
    });

    afterEach(function() {
        jasmine.Ajax.uninstall();
    });

    describe('registerProvider() method', () => {
        it('registers providers only if they are of TypeProvider type', () => {
            typeMatcher.registerProvider(new String('hello'));

            expect(typeMatcher.providers.length).toBe(2);
            expect(typeMatcher.providers[0]).toBe(fooProvider);
            expect(typeMatcher.providers[1]).toBe(barProvider);
        });
    });

    describe('findTypes() method', () => {
        it('returns a promise', (done) => {
            let object = typeMatcher.findTypes({}).then((results) => {
                expect(jasmine.Ajax.requests.count()).toEqual(0);
                expect(results.length).toEqual(0);
                done();
            }).catch(() => {
                done.fail('Promise has been rejected');
            });

            expect(object instanceof Promise).toBeTruthy();
        });

        it('rejects the promise if at least one provider fails', (done) => {
            let url = '/test';
            let status = 404;
            let testProvider = new TypeProvider(url, search => search === 'bar');

            jasmine.Ajax.stubRequest(url).andReturn({
                status: status
            });

            typeMatcher.registerProvider(testProvider);

            typeMatcher.findTypes({bar: {type: null}}).then(() => {
                done.fail('Promise has been resolved');
            }).catch((ex) => {
                expect(jasmine.Ajax.requests.count()).toEqual(2);
                expect(ex instanceof Error).toBeTruthy();
                expect(ex.message).toEqual(`Request with endpoint "${url} returned an HTTP code of ${status}`);
                done();
            });
        });

        describe('resolves the promise', () => {
            describe('with non empty results, only when last JSON key is', () => {
                it('type', (done) => {
                    typeMatcher.findTypes({foo: null}).then((results) => {
                        expect(jasmine.Ajax.requests.count()).toEqual(0);
                        expect(results.length).toEqual(0);
                        return typeMatcher.findTypes({foo: {bar: null}});
                    }).then((results) => {
                        expect(jasmine.Ajax.requests.count()).toEqual(0);
                        expect(results.length).toEqual(0);
                        return typeMatcher.findTypes({foo: {type: null}});
                    }).then((results) => {
                        expect(jasmine.Ajax.requests.count()).toEqual(1);
                        expect(results.length).toEqual(2);
                        expect(results).toEqual(['foo', 'bar']);
                        done();
                    }).catch(() => {
                        done.fail('Promise has been rejected');
                    });
                });
                it('location', (done) => {
                    typeMatcher.findTypes({foo: null}).then((results) => {
                        expect(jasmine.Ajax.requests.count()).toEqual(0);
                        expect(results.length).toEqual(0);
                        return typeMatcher.findTypes({foo: {bar: null}});
                    }).then((results) => {
                        expect(jasmine.Ajax.requests.count()).toEqual(0);
                        expect(results.length).toEqual(0);
                        return typeMatcher.findTypes({foo: {type: null}});
                    }).then((results) => {
                        expect(jasmine.Ajax.requests.count()).toEqual(1);
                        expect(results.length).toEqual(2);
                        expect(results).toEqual(['foo', 'bar']);
                        done();
                    }).catch(() => {
                        done.fail('Promise has been rejected');
                    });
                });
            });
            it('with results that are composed of provider results', (done) => {
                let url = '/test';
                let testProvider = new TypeProvider(url, search => search === 'foo');

                jasmine.Ajax.stubRequest(url).andReturn({
                    responseText: JSON.stringify(['test', 'hello', 'world'])
                });

                typeMatcher.registerProvider(testProvider);
                typeMatcher.findTypes({foo: {type: null}}).then((results) => {
                    expect(jasmine.Ajax.requests.count()).toEqual(2);
                    expect(results.length).toEqual(5);
                    expect(results).toEqual(['foo', 'bar', 'test', 'hello', 'world']);
                    done();
                }).catch(() => {
                    done.fail('Promise has been rejected');
                });
            });
        });
    });
});