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
import {D3BlueprintAbstract} from './d3-blueprint-abstract';
import addIcon from '../../img/icon-add.svg';
import * as d3 from 'd3';

export function D3BlueprintLandscapeView(container) {
    let bp = this;
    let result = D3BlueprintAbstract.call(bp, container);

    function updateLayout(blueprint, relationships, d3data) {
        // TODO new layout will be needed to give fill width
        let tree = d3.tree()
            .nodeSize([bp.config.child.width * 2, bp.config.child.height * 3])
            .separation((right, left)=> {
                let maxColumnsBeforeExpand = 2;
                let adjuncts = bp.getImportantAdjuncts(left).length;
                let currentCols = Math.floor(adjuncts / bp.config.adjunct.itemPerCol) + (adjuncts > 0 && adjuncts % bp.config.adjunct.itemPerCol !== 0 ? 1 : 0);
                let additionalCol = currentCols > maxColumnsBeforeExpand ? currentCols - maxColumnsBeforeExpand : 0;

                let colWidth = bp.config.adjunct.width + 15;

                return 1 + (colWidth / (bp.config.child.radius * 6)) * additionalCol;
            });
        let root = d3.hierarchy(blueprint);
        tree(root);
        d3data.nodes = root.descendants();
        d3data.links = root.links();
        d3data.relationships = relationships;
    };
            
    let tagWithAttrs = (tag, attrs) => { return { tag, attrs }; };
    let addC = (n, ifMissing) => (x) => typeof x !== 'undefined' ? x+n : typeof ifMissing !== 'undefined' ? ifMissing : n;
    
    let getNodeProperty = (node, prop) => {
        let data = bp.isRootNode(node) ? bp.config.root : bp.config.child;
        return data[prop];
    };
    let getPropertyFn = (prop) => (node) => getNodeProperty(node, prop);
    // TODO width and height will be set by layout and should then be retrieved from layout
    let width = (node) => getNodeProperty(node, 'width');
    let height = (node) => getNodeProperty(node, 'height');
    
    let childRadius = 50;
    let locationAttrs = { width: 100, height: 50 };
    Object.assign(locationAttrs, { x: -locationAttrs.width/2, y: -110 });
    let memberspecRadius = 35;  
    
    Object.assign(bp.config, {
        global: {
            transitionDuration: 300,
            nodeWidth: width,
            nodeHeight: height,
            updateLayout,
        },
        
        root: {
            width: 400,
            height: 100,
            maxNameLength: 30,
            shape: tagWithAttrs('rect', {
                    class: 'node-root',
                    x: (d) => -width(d)/2,
                    y: (d) => -height(d)/2,
                    width,
                    height,
                    rx: 15,
                    ry: 15
                }),
            title: tagWithAttrs('text', {
                    class: 'node-name',
                    width,
                    height,
                }),
            dropOverrides: {
                // expand by 7
                x: addC(-7), y: addC(-7), 
                rx: addC(7, 0), ry: addC(7, 0),
                width: addC(2*7), height: addC(2*7),
                class: (c) => (c || '') + ' dropzone dropzone-self',
            },
        },
        
        child: {
            radius: childRadius,
            width: 250,
            height: 100,
            imgSize: 96,
            maxNameLength: 15,
            
            shape: tagWithAttrs('rect', {
                    x: (d) => -width(d)/2,
                    y: (d) => -height(d)/2,
                    width,
                    height,
                    rx: 15,
                    ry: 15,
                    class: (d)=>(`node-cluster node-cluster-${d}`)
                }),
            title: tagWithAttrs('text', {
                    class: 'node-name',
                    width: (d) => width(d) - bp.config.child.imgSize - 16,
                    height,
                    x: 40,
                    y: 0,
                }),
            icon: tagWithAttrs('image', {
                    class: 'node-icon',
                    width: getPropertyFn('imgSize'),
                    height: getPropertyFn('imgSize'),
                    x: (d) => -width(d)/2 + 4,
                    y: (d) => -getPropertyFn('imgSize')(d)/2,
                    opacity: 0
                }),
            dropOverrides: {
                // expand by 7
                x: addC(-7), y: addC(-7), 
                rx: addC(7, 0), ry: addC(7, 0),
                width: addC(2*7), height: addC(2*7),
                class: (c) => (c || '') + ' dropzone dropzone-self',
            },
        },
        
        location: {
            shape: tagWithAttrs('rect', locationAttrs),
            icon: tagWithAttrs('image', Object.assign({ opacity: 0 }, locationAttrs)),
        },
        
        dropzonePrev: {
            shape: tagWithAttrs('circle', {
                    cx: -4*childRadius,
                    r: 3/5 * childRadius,
                    class: 'dropzone dropzone-prev'
                }),
        },
        dropzoneNext: {
            shape: tagWithAttrs('circle', {
                    cx: 4*childRadius,
                    r: 3/5 * childRadius,
                    class: 'dropzone dropzone-next'
                }),
        },
        
        adjunct: {
            width: 20,
            height: 20,
            itemPerCol: 3,
            gutterSize: 15,
            adjunctBox: tagWithAttrs('rect', {
                id: (d)=>(`entity-${d._id}`),  // TODO should this be adjunct-d._id ?
                class: 'node-adjunct adjunct entity',
                width: () => bp.config.adjunct.width,
                height: () => bp.config.adjunct.height,
                transform: 'scale(0)'
            }),
        },
        
        memberspec: {
            deltaX: 0,
            deltaY: 170,
            width: 2*memberspecRadius,
            height: 2*memberspecRadius,
            radius: memberspecRadius,
            iconSize: 40,
            circle: tagWithAttrs('circle', {
                r: () => bp.config.memberspec.radius,
                cx: () => bp.config.memberspec.deltaX,
                cy: () => bp.config.memberspec.deltaY,
                class: 'node-spec-entity',
                'transform-origin': 0
            }),
            icon: tagWithAttrs('image', {
                x: () => bp.config.memberspec.deltaX - bp.config.memberspec.iconSize/2,
                y: () => bp.config.memberspec.deltaY - bp.config.memberspec.iconSize/2,
                width: () => bp.config.memberspec.iconSize,
                height: () => bp.config.memberspec.iconSize,
                opacity: 0,
                class: 'node-spec-image',
                'transform-origin': 0
            }),
        },
        
        buttongroup: {
            lineToGroup: tagWithAttrs('line', {
                    class: 'link',
                    x1: 0,
                    x2: 0,
                    y1: (d) => height(d)/2,
                    y2: (d) => height(d)/2 + 30,
                }),
            circleAsLineSource: tagWithAttrs('circle', {
                    class: 'connector',
                    r: 6,
                    cy: (d) => height(d)/2,
                }),
        },
        buttonAdd: {
            circleAsTarget: tagWithAttrs('circle', {
                    r: 20,
                    cy: 100,
                }),
            imageInGreenCircle: tagWithAttrs('image', {
                    width: 50,
                    height: 50,
                    x: -25,
                    y: 75,
                    'xlink:href': addIcon
                }),
        },
    });
    
    return result;
}
