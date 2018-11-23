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
import {Entity} from '../util/model/entity.model';

const MODULE_NAME = 'brooklyn.composer.service.palette-dragndrop-service';
const TAG = 'SERVICE :: DRAGNDROP :: ';

angular.module(MODULE_NAME, [])
    .provider('paletteDragAndDropService', paletteDragAndDropServiceProvider);

export default MODULE_NAME;

export function paletteDragAndDropServiceProvider() {
    return {
        $get: ['$log', function ($log) {
            return new paletteDragAndDropService($log);
        }]
    }
}

/**
 * Provides state for Drag and Drop operations
 * from the palette into the blueprint graph
 * @param $log
 * @constructor
 */
function paletteDragAndDropService($log) {

    let state = 0; /* 0 = no drag; 1 = drag in progress; 2 = over target */
    let draggedItem = null;
    let dropTarget = null;
    let targetIndex = -1;

    return {
        dragStart: dragStart,
        dragEnd: dragEnd,
        dragEnter: dragEnter,
        dragLeave: dragLeave,
        isDropAllowed: isDropAllowed,
        draggedItem: () => draggedItem,
        dropTarget: () => dropTarget,
        targetIndex: () => targetIndex,
    };

    function isDropAllowed() {
        return state === 2 && draggedItem && dropTarget;
    }

    function dragLeave(id) {
        if (state === 2 && dropTarget && dropTarget._id === id) {
            state = 1;
            dropTarget = null;
            targetIndex = -1;
        }
    }

    function dragEnd() {
        state = 0;
        draggedItem = null;
        dropTarget = null;
        targetIndex = -1;
    }

    /**
     * @param {Entity} entity the Entity
     */
    function dragEnter(entity, index = -1) {
        if (state === 1) {
            state = 2;
        }
        dropTarget = entity;
        targetIndex = index;
    }

    /**
     * @param item
     */
    function dragStart(item) {
        state = 1;
        if (!item) {
            throw new Error('"item" param must be specified');
        }
        draggedItem = item;
    }

}
