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
export function actionServiceProvider() {
    let actions = {};
    return {
        $get: function () {
                return new ActionService(actions);
              },
        addAction(id, action) {
            actions[id] = action;
        },
        deleteAction(id) {
            delete actions[id];
        }
    }
}

function ActionService(actionsToAdd) {
    let actions = {};

    for (const [id, action] of Object.entries(actionsToAdd)) {
        addAction(id, action);
    }

    return {
        addAction: addAction,
        getActions: getActions
    }

    function addAction(id, action) {
        if (!action || !action.hasOwnProperty('html')) {
            throw 'Action must have html defined';
        }
        if (!id) {
            throw 'Action must have id defined';
        }
        actions[id] = action;
    }

    function getActions() {
        return actions;
    }
}