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
import {apiObserverInterceptorProvider} from "./api-observer-interceptor.provider";

describe('API Observer', ()=> {
    var $httpBackend, $rootScope, $http, apihandler;
    beforeEach(()=> {
        angular.module('app', [])
            .provider('apiObserverInterceptor', apiObserverInterceptorProvider)
            .config(['$httpProvider', 'apiObserverInterceptorProvider', ($httpProvider, apiObserverInterceptorProvider)=> {
                $httpProvider.interceptors.push('apiObserverInterceptor');
                apiObserverInterceptorProvider.interval(200);
            }]);
        angular.mock.module('app');
    });
    beforeEach(angular.mock.inject((_$httpBackend_, _$rootScope_, _$http_)=> {
        $rootScope = _$rootScope_;
        $httpBackend = _$httpBackend_;
        $http = _$http_;
    }));

    it('should attach observable to API response that has the observable flag set', (done)=> {
        var expectedResponse = {value: Math.random().toString(36).slice(2)};
        $httpBackend.expect('GET', '/test').respond(expectedResponse);
        $http({
            method: 'GET',
            observable: true,
            url: '/test'
        }).then((response)=> {
            expect(response.data).not.toBeNull();
            expect(response.data.value).toBe(expectedResponse.value);
            expect(response.subscribe).toBeDefined();
            expect(typeof response.subscribe).toEqual('function');
            response.subscribe((x)=> {
                expect(x.data).toBeDefined();
                expect(x.data.value).toBe(expectedResponse.value);
                expect(x.data.subscribe).not.toBeDefined();
                done();
            });
        });
        $httpBackend.flush();
        $httpBackend.expect('GET', '/test').respond(expectedResponse);
        setTimeout(()=> {
            $httpBackend.flush();
            $httpBackend.verifyNoOutstandingRequest();
        }, 250)
    });

    it('should NOT attach observable to API response that doesn\'t have observable flag set', (done)=> {
        var expectedResponse = {value: Math.random().toString(36).slice(2)};
        $httpBackend.expect('GET', '/test').respond(expectedResponse);
        $http({
            method: 'GET',
            url: '/test'
        }).then((response)=> {
            expect(response.data).not.toBeNull();
            expect(response.data.value).toBe(expectedResponse.value);
            expect(response.hasOwnProperty('subscribe')).toBeFalsy();
            done();
        });
        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingRequest();
    });
});