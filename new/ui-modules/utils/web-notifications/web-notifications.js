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

const MODULE_NAME = 'br.utils.web-notifications';

angular.module(MODULE_NAME, [])
    .service('brWebNotifications', ['$q', brWebNotificationsService]);

export default MODULE_NAME;

export function brWebNotificationsService($q) {
    const STORAGE_KEY = `${MODULE_NAME}-enabled`;

    this.supported = 'Notification' in window && 'localStorage' in window ? $q.resolve() : $q.reject();

    this.getPermission = () => {
        return 'Notification' in window ? $q.resolve(Notification.permission) : $q.reject('denied');
    };

    this.requestPermission = () => {
        return this.supported.then(() => {
            return Notification.requestPermission();
        });
    };

    this.isEnabled = () => {
        return this.getPermission().then(permission => {
            let isEnabled = localStorage.getItem(STORAGE_KEY);
            if (isEnabled !== null && isEnabled === '1') {
                // Notification permission has been revoked, we need to set back the persisted value
                if (permission !== 'granted') {
                    return this.setEnable(false).then(() => $q.reject('Notifications are disabled'));
                }
                return $q.resolve();
            }
            return $q.reject('Notifications are disabled');
        })
    };

    this.setEnable = enable => {
        try {
            localStorage.setItem(STORAGE_KEY, enable ? 1 : 0);
            return $q.resolve(enable);
        } catch (ex) {
            return $q.reject(ex);
        }
    };

    this.send = (title, options, showWhenFocused = false) => {
        if (document.hasFocus() && !showWhenFocused) {
            return $q.reject('Window has focus and "showWhenFocused" set to false, notification won\'t be sent');
        }

        return this.supported.then(() => {
            return this.getPermission();
        }).then(permission => {
            if (permission !== 'granted') {
                throw new Error('Permission not granted, cannot send notification');
            }
            return this.isEnabled();
        }).then(() => {
            let n = new Notification(title, options);
            n.onclick = (e)=> {
                e.preventDefault();
                window.focus();
                e.target.close();
                if (e.target.data) {
                    window.location.href = e.target.data;
                }
            }
        });
    };

    return this;
}
