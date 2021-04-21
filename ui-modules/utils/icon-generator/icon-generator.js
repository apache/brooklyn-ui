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
import jsSHA from 'jssha/src/sha512';
import Identicon from 'identicon.js/identicon';

const CACHE_NAME = 'brooklyn-ui.icon-cache';
const MODULE_NAME = 'br.utils.icon-generator';

angular.module(MODULE_NAME, [])
    .provider('iconGenerator', iconGeneratorProvider)
    .provider('iconService', iconServiceProvider)
    .filter('iconGeneratorPipe', ['iconGenerator', iconGeneratorPipe]);

export default MODULE_NAME;

export function iconGeneratorProvider() {
    // session storage can fill up very quickly with icons - best not to use it.
    // generation isn't that big a problem anyway, across tabs.
    // actual icons are probably more expensive, but the browser will cache those for us.
    let useSessionStorage = false;
    let background = [0, 0, 0, 0];
    let margin = 0.2;
    let size = 128;
    return {
        background: function (value) {
            background = value;
            return this;
        },
        margin: function (value) {
            margin = value;
            return this;
        },
        size: function (value) {
            size = value;
            return this;
        },
        disableSessionStorage: function () {
            useSessionStorage = false;
            return this;
        },
        enableSessionStorage: function () {
            useSessionStorage = true;
            return this;
        },
        $get: ['$cacheFactory', function ($cacheFactory) {
            if (useSessionStorage && typeof(Storage) !== "undefined") {
                return new IconGenerator(new SessionsStorageWrapper(CACHE_NAME), background, margin, size);
            } else {
                return new IconGenerator($cacheFactory.get(CACHE_NAME) || $cacheFactory(CACHE_NAME), background, margin, size);
            }
        }]
    };
}

export function iconGeneratorPipe(iconGenerator) {
    return function (input, opts) {
        let field, doNotAutogenerate=false;
        if (opts) {
            if (typeof opts === 'string') {
                field = opts;
            } else {
                field = opts.field;
                doNotAutogenerate = opts.doNotAutogenerate;
            }
        }
        let generateFrom = input;
        if (input && typeof(input) === 'object') {
            if (input.hasOwnProperty('iconUrl') && input.iconUrl) {
                return input.iconUrl;
            } else if (input.hasOwnProperty('links') && input.links.hasOwnProperty('iconUrl') && input.links.iconUrl) {
                return input.links.iconUrl;
            } else if (input.hasOwnProperty(field || 'id')) {
                generateFrom = input[field || 'id'];
            }
        }
        if (doNotAutogenerate) {
            return null;
        }
        return iconGenerator(generateFrom);
    }
}

function IconGenerator(cache, background, margin, size) {
    return function (salt) {
        let icon;
        if (angular.isDefined(salt)) {
            icon = cache.get(salt);
        }
        if (angular.isUndefined(icon)) {
            let hash = new jsSHA('SHA-512', 'TEXT');
            let options = {
                background: background,
                margin: margin,
                size: size
            };
            hash.update(salt || new Date().getTime());

            icon = 'data:image/png;base64,' + new Identicon(hash.getHash('HEX'), options).toString();
            if (angular.isDefined(salt)) {
                cache.put(salt, icon);
            }
        }

        return icon;
    }
}

export function iconServiceProvider() {
    return {
        $get: ['$q', '$http', 'iconGenerator', '$log', function ($q, $http, iconGenerator, $log) {
            return new IconService($q, $http, iconGenerator, $log, new SessionsStorageWrapper(CACHE_NAME));
        }]
    }
}

function IconService($q, $http, iconGenerator, $log, cache) {
    this.get = getIcon;
    function getIcon(entityOrTypeId, doNotAutogenerate) {
        let deferred = $q.defer();

        let id;
        if (typeof entityOrTypeId === 'string') {
            id = entityOrTypeId;
        } else if (typeof entityOrTypeId === 'object') {
            if (entityOrTypeId.iconUrl) {
                deferred.resolve(entityOrTypeId.iconUrl);
                return deferred.promise;
            }
            if (entityOrTypeId.links && entityOrTypeId.links.iconUrl) {
                deferred.resolve(entityOrTypeId.links.iconUrl);
                return deferred.promise;
            }
            if (entityOrTypeId.catalogItemId) {
                id = entityOrTypeId.catalogItemId;
            } else if (entityOrTypeId.symbolicName) {
                id = entityOrTypeId.symbolicName;
            } else if (entityOrTypeId.type) {
                let entity = entityOrTypeId;
                id = entity.type;
                if (id === 'org.apache.brooklyn.entity.stock.BasicApplication' && entity.children && entity.children.length === 1) {
                    id = entity.children[0].catalogItemId || entity.children[0].type;
                }
            }
        }
        
        let icon;
        if (angular.isDefined(id)) {
            icon = cache.get(id);
        } else {
            $log.warn('No ID found for item, cannot make icon - '+entityOrTypeId, entityOrTypeId);
            deferred.reject('No ID found for item, cannot make icon - '+entityOrTypeId);
            return deferred.promise;
        }
        if (angular.isUndefined(icon)) {
            let path = id.split(':');
            $http({
                method: 'GET',
                cache: true,
                url: '/v1/catalog/entities/' + path[0] + '/' + (path[1] || 'latest')
            }).then((response)=> {
                if (response.data.hasOwnProperty('iconUrl')) {
                    icon = response.data.iconUrl;
                    cache.put(id, icon);
                } else if (doNotAutogenerate) {
                    icon = null;
                } else {
                    icon = iconGenerator(id);
                }
                deferred.resolve(icon)
            }, ()=> {
                deferred.resolve(iconGenerator(id));
            });
        } else {
            deferred.resolve(icon);
        }
        return deferred.promise;
    }
}

function SessionsStorageWrapper(cacheName) {
    this.get = getValue;
    this.put = putValue;

    var disabled = null;
    var count = 0;

    // session storage can fill up very quickly with icons - so have some good error checking

    function getValue(key, defaultValue) {
        //if (count++ % 1000 < 10) console.log("SessionStorage access for "+key+": "+( sessionStorage.getItem(cacheName + '.' + key) ? "hit" : "miss" )+" (count "+count+")");
        return sessionStorage.getItem(cacheName + '.' + key) || defaultValue || undefined;
    }

    function putValue(key, value) {
        //if (count++ % 1000 < 10) console.log("SessionStorage write for "+key+": "+( sessionStorage.getItem(cacheName + '.' + key) ? "already present" : "not present" )+" (count "+count+")");
        if (disabled) {
            if (disabled + 60*1000 < Date.now()) {
                console.log("Attempting to re-enable session storage");
                disabled = null;
            } else {
                return;
            }
        }
        try {
            sessionStorage.setItem(cacheName + '.' + key, value);
        } catch (ex) {
            console.warn("Error setting cache value in session storage; will try clearing and retrying", cacheName, key, ex);
            sessionStorage.clear();
            try {
                sessionStorage.setItem(cacheName + '.' + key, value);
                console.log("Succeeded after clearing cache");
            } catch (ex2) {
                console.warn("Failed even after clearing cache; will disable session storage for a period", ex2);
                disabled = Date.now();
            }
        }
    }
}
