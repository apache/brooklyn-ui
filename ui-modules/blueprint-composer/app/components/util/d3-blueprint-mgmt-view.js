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

export function D3BlueprintMgmtView(container) {
    let d3b = this;
    let result = D3BlueprintAbstract.call(d3b, container);
    
    Object.assign(d3b._configHolder, {
        nodes: {
            root: {
                rect: {
                    class: 'node-root',
                    x: -125,
                    y: -50,
                    width: 250,
                    height: 100,
                    rx: 50,
                    ry: 50,
                },
                text: {
                    class: 'node-name',
                    width: 250,
                    height: 100
                },
                maxNameLength: 18
            },
            child: {
                circle: {
                    r: 50,
                    class: (d)=>(`node-cluster node-cluster-${d}`)
                },
                image: {
                    class: 'node-icon',
                    width: 64,
                    height: 64,
                    x: -32,
                    y: -32,
                    opacity: 0
                }
            },
            location: {
                rect: {
                    x: -50,
                    y: -110,
                    width: 100,
                    height: 50
                },
                image: {
                    x: -50,
                    y: -110,
                    width: 100,
                    height: 50,
                    opacity: 0
                }
            },
            dropzonePrev: {
                circle: {
                    cx: -150,
                    r: 30,
                    class: 'dropzone dropzone-prev'
                },
            },
            dropzoneNext: {
                circle: {
                    cx: 150,
                    r: 30,
                    class: 'dropzone dropzone-next'
                }
            },
            adjunct: {
                rect: {
                    id: (d)=>(`entity-${d._id}`),
                    class: 'node-adjunct adjunct entity',
                    width: 20,
                    height: 20,
                    transform: 'scale(0)'
                }
            },
            memberspec: {
                circle: {
                    r: 35,
                    cx: 0,
                    cy: 170,
                    class: 'node-spec-entity',
                    'transform-origin': 0
                },
                image: {
                    x: -20,
                    y: 150,
                    width: 40,
                    height: 40,
                    opacity: 0,
                    class: 'node-spec-image',
                    'transform-origin': 0
                }
            },
            buttongroup: {
                line: {
                    class: 'link',
                    x1: 0,
                    x2: 0,
                    y1: (d)=>(d3b.isRootNode(d) ? d3b._configHolder.nodes.root.rect.height / 2 : d3b._configHolder.nodes.child.circle.r),
                    y2: (d)=>((d3b.isRootNode(d) ? d3b._configHolder.nodes.root.rect.height / 2 : d3b._configHolder.nodes.child.circle.r) + 30),
                },
                circle: {
                    class: 'connector',
                    r: 6,
                    cy: (d)=>(d3b.isRootNode(d) ? d3b._configHolder.nodes.root.rect.height / 2 : d3b._configHolder.nodes.child.circle.r),
                }
            },
            buttonAdd: {
                circle: {
                    r: 20,
                    cy: 100
                },
                image: {
                    width: 50,
                    height: 50,
                    x: -25,
                    y: 75,
                    'xlink:href': d3b.addIcon
                }
            }
        },
        transition: 300,
        grid: {
            itemPerCol: 3,
            gutter: 15
        },
    });
    
    return result;
}
