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
import {Observable} from "rxjs/Observable";
import "rxjs/add/observable/interval";
import "rxjs/add/operator/exhaust";
import "rxjs/add/operator/mapTo";
import "rxjs/add/operator/share";

const OBSERVER_CACHE = new Map();
const OBSERVABLE = 'observable';

export function apiObserverInterceptorProvider() {
    let interval = 10000;
    let clock = Observable.interval(10000);

    return {
        interval: (value)=> {
            interval = value;
            clock = Observable.interval(interval);
        },
        $get: ['$injector', '$q', ($injector, $q)=> {
            return {
                response: (response)=> {
                    doDriveBy(response);
                    return response;
                },
                responseError: (rejection)=> {
                    doDriveBy(rejection, true);
                    return $q.reject(rejection);
                }
            };

            function doDriveBy(response, error = false) {
                if ((response.config || {}).hasOwnProperty(OBSERVABLE) && response.config[OBSERVABLE]) {
                    response.clock = clock;
                    response.interval = (interval) => {
                        response.clock = Observable.interval(interval);
                    }
                    response.subscribe = (next, error, complete)=> {
                        const key = response.config.url+'?'+JSON.stringify(response.config.params);
                        if (!OBSERVER_CACHE.has(key)) {
                            OBSERVER_CACHE.set(key, response.clock.mapTo(coldObservableFactory(response.config)).exhaust().share());
                        }
                        return OBSERVER_CACHE.get(key).subscribe(next, error, complete);
                    }
                }
            }

            function coldObservableFactory(httpConfig) {
                return Observable.create((observer)=> {
                    let $http = $injector.get('$http');
                    $http(Object.assign(httpConfig, {observable: false, cache: null}))
                        .then((response)=> {
                            observer.next(response);
                            observer.complete();
                        }, (error)=> {
                            observer.error(error);
                            observer.complete();
                        });
                });
            }
        }]
    };
}