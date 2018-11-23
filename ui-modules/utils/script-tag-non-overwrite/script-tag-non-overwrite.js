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

/**
 * If included, this decorates the default angular `<script>` tag so that it if a
 * 'defer-to-preexisting-id' attribute is set, it will check the template cache and 
 * skip putting the contents of the `script` into the cache if there is already an 
 * element with that ID present.
 *
 * This allows us to include `<script type="ng-template" id="..." defer-to-preexisting-id="true">` blocks 
 * in HTML templates that work in the usual way, but with the extra "defer" attribute we can allow
 * the template to be overridden by a `run` block (or other block) installing a custom HTML template
 * under the same ID.  (By default the `script` directive will always install the ID, on every
 * directive processing on the template, meaning one cannot easily override the template.) 
 */

const MODULE_NAME = 'brooklyn.components.script-tag-non-overwrite';

angular.module(MODULE_NAME, [])
    .decorator('scriptDirective', ['$delegate', '$templateCache', scriptTagDirectiveDecorator]);

export default MODULE_NAME;

const BROOKLYN_CONFIG = 'brooklyn.config';

function scriptTagDirectiveDecorator($delegate, $templateCache) {
    let base = $delegate[0];
    return [ Object.assign({}, base, { compile: function(el, attr) {
        let match = $templateCache.get(attr.id);
        if (attr.deferToPreexistingId && !(match === null || typeof match === 'undefined')) {
            // no-op if this ID is already in the cache (e.g. manually overridden)
            return function() {};
        }
        // otherwise do default behaviour
        return base.compile(el, attr);
    } }) ];
}
