/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
(function(window, document) {
    window.addEventListener('load', initiateLogout, false)

    /**
     * Fetch current user
     */
    function initiateLogout() {
        var userRequest = new XMLHttpRequest();
        userRequest.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                logout(this.responseText)
            }
        };
        userRequest.open('GET', '/v1/server/user', true);
        userRequest.send('');
    }

    function currentCsrfHeader() {
        var ca = document.cookie.split(';');
        var extraFields = [];
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1);
            if (c.toLowerCase().indexOf('csrf-token') != -1) {
                var parts = c.split('=');
                extraFields.push('X-'+parts[0])
                extraFields.push(parts[1]);
            }
        }
        return extraFields;
    }

    /**
     * Logout the supplied user
     * @param user
     */
    function logout(user) {
        var ua = window.navigator.userAgent;
        var logoutRequest = new XMLHttpRequest();
        var extraFields = currentCsrfHeader();
        if (ua.indexOf('MSIE ') >= 0 || ua.indexOf(' Edge/') >= 0 || ua.indexOf(' Trident/') >= 0) {
            document.execCommand('ClearAuthenticationCache', 'false');
        }
        logoutRequest.onreadystatechange = function () {
            if (this.readyState === 4) {
                if (this.status === 401) {
                    console.info('User ' + user + ' logged out')
                } else {
                    setTimeout(function () {
                        logout(user);
                    }, 1000);
                }
            }
        };
        logoutRequest.open('POST', '/v1/logout/unauthorize', true, user, Math.random().toString(36).slice(2));
        if (extraFields.length == 2) {
            logoutRequest.setRequestHeader(extraFields[0], extraFields[1])
        }
        logoutRequest.send('');
    }
})(window, document);