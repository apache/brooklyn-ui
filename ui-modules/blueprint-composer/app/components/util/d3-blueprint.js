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
import * as d3 from 'd3';
import {PREDICATE_MEMBERSPEC} from './model/entity.model';
import addIcon from '../../img/icon-add.svg';
import {ISSUE_LEVEL} from './model/issue.model';

export function D3Blueprint(container) {
    let _svg = d3.select(container).append('svg').attr('class', 'blueprint-canvas');
    let _mirror = _svg.append('path').style('display', 'none');
    let _zoomGroup = _svg.append('g').attr('class', 'zoom-group');
    let _parentGroup = _zoomGroup.append('g').attr('class', 'parent-group');
    let _linkGroup = _parentGroup.append('g').attr('class', 'link-group');
    let _relationGroup = _parentGroup.append('g').attr('class', 'relation-group');
    let _specNodeGroup = _parentGroup.append('g').attr('class', 'spec-node-group');
    let _dropZoneGroup = _parentGroup.append('g').attr('class', 'dropzone-group');
    let _ghostNodeGroup = _parentGroup.append('g').attr('class', 'ghost-node-group');
    let _nodeGroup = _parentGroup.append('g').attr('class', 'node-group');
    let _cloneGroup = _parentGroup.append('g').attr('class', 'clone-group');

    let _dragState = {
        dragInProgress: false,
        dragStarted: false,
        clone: null,
        cloneX: 0,
        cloneY: 0,
    };

    const _configHolder = {
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
                    y1: (d)=>(isRootNode(d) ? _configHolder.nodes.root.rect.height / 2 : _configHolder.nodes.child.circle.r),
                    y2: (d)=>((isRootNode(d) ? _configHolder.nodes.root.rect.height / 2 : _configHolder.nodes.child.circle.r) + 30),
                },
                circle: {
                    class: 'connector',
                    r: 6,
                    cy: (d)=>(isRootNode(d) ? _configHolder.nodes.root.rect.height / 2 : _configHolder.nodes.child.circle.r),
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
                    'xlink:href': addIcon
                }
            }
        },
        transition: 300,
        grid: {
            itemPerCol: 3,
            gutter: 15
        },
    };
    let _d3DataHolder = {
        nodes: [],
        ghostNodes: [],
        orphans: [],
        links: [],
        relationships: [],
    };

    let zoom = d3.zoom().scaleExtent([0.1, 1]).on('zoom', onSvgZoom);
    _svg
        .attr('preserveAspectRatio', 'xMinYMin meet')
        .attr('viewBox', () => {
            return `0 0 ${parseInt(_svg.style('width'))} ${parseInt(_svg.style('height'))}`;
        })
        .on('click', onSvgClick)
        .on('dragover', onSvgDragOver)
        .on('dragleave', onSvgDragLeave)
        .call(zoom);

    let pattern = _svg.append('pattern')
        .attr('id', 'fill-has-issues')
        .attr('width', 4)
        .attr('height', 4)
        .attr('patternUnits', 'userSpaceOnUse');
    pattern.append('rect')
        .attr('width', 4)
        .attr('height', 4);
    pattern.append('path')
        .attr('d', 'M1 3h1v1H1V3zm2-2h1v1H3V1z');

    let defs = _svg.append('defs');
    let arrowhead = defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('orient', 'auto')
        .attr('markerWidth', 10)
        .attr('markerHeight', 20)
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('refX', 0)
        .attr('refY', 10);
    arrowhead.append('path')
        .attr('d', 'M0,0 V20 L10,10 Z')
        .attr('class', 'arrowhead');
    let arrowheadHighlight = defs.append('marker')
        .attr('id', 'arrowhead-highlight')
        .attr('orient', 'auto')
        .attr('markerWidth', 10)
        .attr('markerHeight', 20)
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('refX', 0)
        .attr('refY', 10);
    arrowheadHighlight.append('path')
        .attr('d', 'M0,0 V20 L10,10 Z')
        .attr('class', 'arrowhead-highlight');

    /*****************************
     ** EVENT HANDLERS :: START **
     *****************************/

    /**
     * Handles translation and scaling of the zoom group
     */
    function onSvgZoom() {
        _zoomGroup.attr('transform', d3.event.transform);
    }

    /**
     * Fires a custom event "click-svg" when the use clicks anywhere on the canvas, except nodes.
     */
    function onSvgClick() {
        if (d3.event.defaultPrevented) return;
        let event = new CustomEvent('click-svg', {});
        container.dispatchEvent(event);
    }

    /**
     * Applies the "is-dragging" class to the canvas when a drag is initiated.
     */
    function onSvgDragOver() {
        _svg.classed('is-dragging', true);

        if (d3.event.dataTransfer && d3.event.dataTransfer.types.indexOf('entity') === -1) {
            _dropZoneGroup.selectAll('.dropzone-prev').classed('hidden', true);
            _dropZoneGroup.selectAll('.dropzone-next').classed('hidden', true);
        }
    }

    /**
     * Removes the "is-dragging" class from the canvas when a drag is finished.
     */
    function onSvgDragLeave() {
        _svg.classed('is-dragging', false);

        if (d3.event.dataTransfer && d3.event.dataTransfer.types.indexOf('entity') === -1) {
            _dropZoneGroup.selectAll('.dropzone-prev').classed('hidden', false);
            _dropZoneGroup.selectAll('.dropzone-next').classed('hidden', false);
        }
    }

    /**
     * Mouse Enter Event Handler
     *
     * @param {object} node The graph node the mouse is over
     */
    function onGhostOver(node) {
        d3.select(`#ghost-node-${node.data._id} g.buttons`).classed('active', true);
        // show whole group not just buttons
    }

    /**
     * Mouse Leave Event Handler
     *
     * @param {object} node The graph node the mouse just left
     */
    function onGhostLeave(node) {
        d3.select(`#ghost-node-${node.data._id} g.buttons`).classed('active', false);
    }

    /**
     * Fires a custom event "click-entity" when a graph node is clicked.
     *
     * @param {object} node The node for the clicked entity
     */
    function onEntityClick(node) {
        if (d3.event.defaultPrevented) return;
        d3.event.stopPropagation();
        let event = new CustomEvent('click-entity', {
            detail: {
                entity: node.data || node,
            }
        });
        container.dispatchEvent(event);
    }

    /**
     * Fires a custom event "click-add-child" when the plus button is clicked.
     *
     * @param {object} node The node for the entity to add a child to
     */
    function onAddChildClick(node) {
        d3.event.stopPropagation();
        let event = new CustomEvent('click-add-child', {
            detail: {
                entity: node.data,
            }
        });
        container.dispatchEvent(event);
    }

    /**
     * Triggered when a key is release on the page.
     *
     * * Ignores where key press did not originate from the page body (i.e. ignores input to text fields)
     * * Fires a custom event "delete-entity" when the delete key is pressed.
     */
    function onKeyUp() {
        d3.event.stopPropagation();
        if (d3.event.target.nodeName == 'BODY') {
            if (d3.event.key === "Delete" || d3.event.key === "Backspace") {
                var selected = _svg.selectAll('.entity.selected');
                var nItemsSelected = selected._groups[0].length;
                if (nItemsSelected > 0) {
                    let event = new CustomEvent("delete-entity", {
                          detail: {
                              entity: selected.data()[0].data,
                          }
                      });
                    container.dispatchEvent(event);
                }
            }
        }
    }

    /**
     * Handles the start of a drag operation. Note that this callback is to be used with the internal D3 drag feature.
     *
     * @param node The node for the dragged entity
     */
    function onDragStart(node) {
        if (_dragState.clone) {
            _dragState.clone.remove();
            _dragState.clone = null;
        }
        if (node.depth) { // exclude the root element
            onSvgDragOver();
            hideInvalidDropzones(node);

            d3.event.sourceEvent.preventDefault(); // disable browser text selection
            d3.event.sourceEvent.stopPropagation();
            _dragState.dragInProgress = true;
            // at this point, we still don't know if this will be a click or a real drag
            // so we defer the visual effects to the first 'dragging' event
            _dragState.dragStarted = true;
            let entityId = node.data._id;
            let mouseCoords = d3.mouse(_nodeGroup.select(`#entity-${node.data._id}`).node());
            _dragState.cloneX = node.x + _configHolder.nodes.child.circle.r + mouseCoords[0];
            _dragState.cloneY = node.y + _configHolder.nodes.child.circle.r + mouseCoords[1];
            _dragState.clone = _cloneGroup.append('use')
                .attr('xlink:href', function(d) {
                    return `#entity-${entityId}` } )
                .attr('opacity', 0)
                .attr('transform', (d)=>(`translate(${_dragState.cloneX}, ${_dragState.cloneY})`));
        }
    }

    /**
     * Handles the dragging operation. Note that this callback is to be used with the internal D3 drag feature.
     *
     * @param node The node for the dragged entity
     */
    function onDrag(node) {
        if (_dragState.dragInProgress) {
            if (_dragState.dragStarted) {
                // deferred initialization of visual effects
                _dragState.dragStarted = false;
                hideRelationships(node);
                _dragState.clone.attr('opacity', 0.5);
            }
            if (_dragState.clone) {
                _dragState.cloneX += d3.event.dx;
                _dragState.cloneY += d3.event.dy;
                _dragState.clone.attr('transform', (d)=>(`translate(${_dragState.cloneX}, ${_dragState.cloneY})`));
            }
        }
    }

    /**
     * Fires a custom event "move-entity" when an graph node has been dragged and dropped in a valid dropzone.
     * Note that this callback is to be used with the internal D3 drag feature.
     *
     * @param node The node for the dragged entity
     */
    function onDragEnd(node) {
        if (_dragState.dragInProgress) {
            _dragState.dragInProgress = false;
            // Firefox support (target)
            let dropZone = d3.event.sourceEvent.toElement ? d3.event.sourceEvent.toElement : d3.event.sourceEvent.target;
            if (['node-root', 'node-name', 'node-icon', 'node-cluster'].some(className => dropZone.classList.contains(className))) {
                dropZone = dropZone.parentElement;
            }
            if (dropZone && dropZone.classList.contains('dropzone')) {
                let parentId = dropZone.getAttribute('parentId');
                let dropzoneId = dropZone.classList.contains('dropzone-next') || dropZone.classList.contains('dropzone-prev')
                        ? dropZone.id
                        : `dropzone-self-${parentId}`;
                onDragLeave(node, dropzoneId);

                if (node.data._id !== parentId) {
                    let event = new CustomEvent('move-entity', {
                        detail: {
                            nodeId: node.data._id,
                            parentId: parentId,
                            targetIndex: dropZone.getAttribute('targetIndex'),
                        },
                    });
                    container.dispatchEvent(event);
                }
            } else {
                setTimeout(() => {
                    showRelationships();
                    showDropzones();
                }, _configHolder.transition);
            }
        }
        if (_dragState.clone) {
            _dragState.clone.remove();
            _dragState.clone = null;
        }

        onSvgDragLeave();
    }

    /**
     * Applies the class "active" to the currently hovered dropzone, or the dropzone with the optional given ID.
     *
     * @param {*} node the graph node the event refers to
     * @param {String} id Optional Id of the dropzone
     */
    function onDragOver(node, id) {
        if (_dragState.dragInProgress || (d3.event && d3.event.type === 'dragover')) {
            if (!id) {
                id = (d3.event.sourceEvent ? d3.event.sourceEvent : d3.event).target.id;
            }

            if (id) {
                _dropZoneGroup.select(`#${id}`).classed('active', true)
            }
        } else {
            onGhostOver(node);
        }
    }

    /**
     * Removes the class "active" from the previously hovered dropzone, or the dropzone with the optional given ID.
     *
     * @param {*} node the graph node the event refers to
     * @param {String} id Optional Id of the dropzone
     */
    function onDragLeave(node, id) {
        if (_dragState.dragInProgress  ||
                (d3.event && (['end','drop','dragleave'].includes(d3.event.type)))) {
            if (!id) {
                id = (d3.event.sourceEvent ? d3.event.sourceEvent : d3.event).target.id;
            }

            if (id) {
                _dropZoneGroup.select(`#${id}`).classed('active', false)
            }
        } else {
            onGhostLeave(node);
        }
    }

    /**
     * Fires a custom event "drop-node" when an external node has been dragged and dropped in a valid dropzone.
     * Note that this callback is to be used with the external drag feature, i.e. HTML5
     *
     * @param {String} id Optional Id of the dropzone
     */
    function onExternalDrop(node, id) {
        let dropZone = d3.event.toElement ? d3.event.toElement : d3.event.target;
        if (['node-root', 'node-name', 'node-icon', 'node-cluster'].some(className => dropZone.classList.contains(className))) {
            dropZone = dropZone.parentElement;
        }
        if (dropZone && dropZone.classList.contains('dropzone')) {
            onDragLeave(node, id);

            let event = new CustomEvent('drop-external-node', {
                detail: {
                    parentId: dropZone.getAttribute('parentId'),
                    targetIndex: dropZone.getAttribute('targetIndex'),
                },
            });
            container.dispatchEvent(event);
        }

        onSvgDragLeave();
    }

    /***************************
     ** EVENT HANDLERS :: END **
     ***************************/

    /**
     * Update the graph data
     *
     * @param {object} blueprint The graph
     */
    function update(blueprint, relationships) {
        let tree = d3.tree()
            .nodeSize([_configHolder.nodes.child.circle.r * 6, _configHolder.nodes.child.circle.r * 6])
            .separation((right, left)=> {
                let maxColumnsBeforeExpand = 2;
                let adjuncts = getImportantAdjuncts(left).length;
                let currentCols = Math.floor(adjuncts / _configHolder.grid.itemPerCol) + (adjuncts > 0 && adjuncts % _configHolder.grid.itemPerCol !== 0 ? 1 : 0);
                let additionalCol = currentCols > maxColumnsBeforeExpand ? currentCols - maxColumnsBeforeExpand : 0;

                let colWidth = _configHolder.nodes.adjunct.rect.width + 15;

                return 1 + (colWidth / (_configHolder.nodes.child.circle.r * 6)) * additionalCol;
            });
        let root = d3.hierarchy(blueprint);
        tree(root);
        _d3DataHolder.nodes = root.descendants();
        _d3DataHolder.links = root.links();
        _d3DataHolder.relationships = relationships;
        return this;
    }

    /**
     * Redraw the graph
     */
    function draw() {
        drawLinks();
        drawRelationships();
        drawNodeGroup();
        drawSpecNodeGroup();
        drawGhostNode();
        drawDropZoneGroup();
        return this;
    }

    function drawNodeGroup() {
        let nodeData = _nodeGroup.selectAll('g.node')
            .data(_d3DataHolder.nodes, (d)=>(`node-${d.data._id}`));

        // Draw group that contains all SVG element: node representation and location/policies/enricher indicators
        // -----------------------------------------------------
        let nodeGroup = nodeData
            .enter()
            .append('g')
            .attr('id', (d)=>(`node-group-${d.data._id}`))
            .attr('class', 'node')
            .classed('node-root', isRootNode)
            .classed('node-child', isChildNode)
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y}) scale(${isRootNode(d) ? 1 : 0})`))
            .attr('opacity', (d)=> (isRootNode(d) ? 0 : 1));
        nodeData.transition()
            .duration(_configHolder.transition)
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y}) scale(1)`))
            .attr('opacity', 1);
        nodeData.exit()
            .transition()
            .duration(_configHolder.transition)
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y}) scale(${isRootNode(d) ? 1 : 0})`))
            .attr('opacity', (d)=> (isRootNode(d) ? 0 : 1))
            .remove();

        // Draw the node-entity group that will contain the node representation
        // -----------------------------------------------------
        let entity = nodeGroup.append('g')
            .attr('class', 'node-entity entity')
            .on('click', onEntityClick)
            .on('mouseenter', onGhostOver)
            .on('mouseleave', onGhostLeave)
            .call(d3.drag()
                .on('start', onDragStart)
                .on('drag', onDrag)
                .on('end', onDragEnd));
        nodeData.select('g.node-entity')
            .attr('id', (d)=>(`entity-${d.data._id}`))
            .classed('clustered', (d)=>(d.data.isCluster()))
            .classed('has-warnings', (d)=>(d.data.hasIssues() && d.data.issues.some(issue => issue.level === ISSUE_LEVEL.WARN)))
            .classed('has-errors', (d)=>(d.data.hasIssues() && d.data.issues.some(issue => issue.level === ISSUE_LEVEL.ERROR)))
            .classed('loading', (d)=>(d.data.miscData.get('loading')));

        // Draw root node
        appendElements(entity.filter(isRootNode), _configHolder.nodes.root);
        nodeData.filter(isRootNode).select('.node-entity text')
            .text(trimNodeText)
            .transition()
            .duration(_configHolder.transition)
            .text(trimNodeText);
        nodeData.filter(isChildNode).select('.node-entity image')
            .transition()
            .duration(_configHolder.transition)
            .attr('opacity', (d)=>(d.data.hasIcon() ? 1 : 0))
            .attr('xlink:href', (d)=>(d.data.icon));

        // Draw child nodes
        appendElement(entity.filter(isChildNode).selectAll('circle').data([2, 1, 0]).enter(), 'circle', _configHolder.nodes.child.circle);
        appendElement(entity.filter(isChildNode), 'image', _configHolder.nodes.child.image);

        // Draw location
        // -----------------------------------------------------
        let location = nodeGroup.append('g')
            .attr('class', 'node-location')
            .classed('loading', (d)=>(d.data.miscData.get('loading')));
        nodeData.select('g.node-location')
            .transition()
            .duration(_configHolder.transition)
            .attr('opacity', (d)=>(d.data.hasLocation() ? 1 : 0));
        appendElements(location, _configHolder.nodes.location);
        nodeData.select('g.node-location image')
            .transition()
            .duration(_configHolder.transition)
            .attr('opacity', (d)=>(d.data.miscData.get('locationIcon') ? 1 : 0))
            .attr('xlink:href', (d)=>(d.data.miscData.get('locationIcon')));

        // Draw important adjuncts (i.e policies/enrichers)
        // -----------------------------------------------------
        nodeGroup.append('g')
            .attr('class', 'node-adjuncts');
        let adjunctData = nodeData.select('g.node-adjuncts')
            .selectAll('rect.adjunct')
            .data((d)=>(getImportantAdjuncts(d)), (d)=>(`adjunct-${d._id}`));
        adjunctData
            .classed('has-warnings', (d)=>(d.hasIssues() && d.issues.some(issue => issue.level === ISSUE_LEVEL.WARN)))
            .classed('has-errors', (d)=>(d.hasIssues() && d.issues.some(issue => issue.level === ISSUE_LEVEL.ERROR)))
            .classed('loading', (d)=>(d.miscData.get('loading')))
            .on('click', onEntityClick);
        adjunctData.transition()
            .duration(_configHolder.transition)
            .attr('x', (d, i)=>(getGridX(d, i)))
            .attr('y', (d, i)=>(getGridY(d, i)))
            .attr('transform', 'scale(1)')
            .attr('transform-origin', (d, i)=>(getGridItemCenter(d, i)));
        adjunctData.exit()
            .transition()
            .duration(_configHolder.transition)
            .attr('transform', 'scale(0)')
            .remove();
        appendElement(adjunctData.enter(), 'rect', _configHolder.nodes.adjunct.rect);
    }

    function drawLinks() {
        let link = _linkGroup.selectAll('line.link')
            .data(_d3DataHolder.links, (d)=>(d.source.data._id + '_to_' + d.target.data._id));

        link.enter().insert('line')
            .attr('class', 'link')
            .attr('x1', (d)=>(d.source.x))
            .attr('y1', (d)=>(d.source.y))
            .attr('x2', (d)=>(d.source.x))
            .attr('y2', (d)=>(d.source.y));
        link.transition()
            .duration(_configHolder.transition)
            .attr('x1', (d)=>(d.source.x))
            .attr('y1', (d)=>(d.source.y))
            .attr('x2', (d)=>(d.target.x))
            .attr('y2', (d)=>(d.target.y));
        link.exit()
            .transition()
            .attr('opacity', 0)
            .remove();
    }

    /**
     * returns the D3 tree node for a given Entity
     * @param {Entity} entity
     * @return {*} a D3 tree node
     */
    function nodeForEntity(entity) {
        let node = _d3DataHolder.nodes.find(d => {
            let predicate = d.data._id === entity._id;
            if (!!d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC)) {
                predicate |= d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC)._id === entity._id;
            }
            return predicate;
        });
        if (!node) {
            throw new Error('Node for Entity ' + entity._id + ' not found');
        }
        return node;
    }

    function drawRelationships() {
        showRelationships();

        let relationData = _relationGroup.selectAll('.relation')
            .data(_d3DataHolder.relationships, (d)=>(d.source._id + '_related_to_' + d.target._id));

        relationData.enter().insert('path')
            .attr('class', 'relation')
            .attr('opacity', 0)
            .attr('from', (d)=>(d.source._id))
            .attr('to', (d)=>(d.target._id));
        relationData.transition()
            .duration(_configHolder.transition)
            .attr('opacity', 1)
            .attr('stroke', 'red')
            .attr('d', function(d) {
                let targetNode = nodeForEntity(d.target);
                let sourceNode = nodeForEntity(d.source);
                let sourceY = sourceNode.y + (d.source.isMemberSpec() ? _configHolder.nodes.memberspec.circle.cy : 0);
                let targetY = targetNode.y + (d.target.isMemberSpec() ? _configHolder.nodes.memberspec.circle.cy : 0);
                let dx = targetNode.x - sourceNode.x;
                let dy = targetY - sourceY;
                let dr = Math.sqrt(dx * dx + dy * dy);
                let sweep = dx * dy > 0 ? 0 : 1;
                _mirror.attr('d', `M ${sourceNode.x},${sourceY} A ${dr},${dr} 0 0,${sweep} ${targetNode.x},${targetY}`);

                let m = _mirror._groups[0][0].getPointAtLength(_mirror._groups[0][0].getTotalLength() - _configHolder.nodes.child.circle.r - 20);

                dx = m.x - sourceNode.x;
                dy = m.y - sourceY;
                dr = Math.sqrt(dx * dx + dy * dy);

                return `M ${sourceNode.x},${sourceY} A ${dr},${dr} 0 0,${sweep} ${m.x},${m.y}`;
            });
        relationData.exit()
            .transition()
            .duration(_configHolder.transition)
            .attr('opacity', 0)
            .remove();
    }

    function drawGhostNode() {
        let ghostNodeData = _ghostNodeGroup.selectAll('g.ghost-node')
            .data(_d3DataHolder.nodes, (d)=>(`ghost-node-${d.data._id}`));
        let ghostNode = ghostNodeData
            .enter()
            .append('g')
            .attr('id', (d)=>(`ghost-node-${d.data._id}`))
            .attr('class', 'ghost-node')
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y})`))
            .on('mouseenter', onGhostOver)
            .on('mouseleave', onGhostLeave);
        ghostNodeData
            .transition()
            .duration(_configHolder.transition)
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y})`));
        ghostNodeData.exit().remove();

        ghostNode.append('rect')
            .attr('class', 'ghost')
            .attr('width', (d)=>(isRootNode(d) ? _configHolder.nodes.root.rect.width : _configHolder.nodes.child.circle.r * 2))
            .attr('height', (d)=>((isRootNode(d) ? _configHolder.nodes.root.rect.height : _configHolder.nodes.child.circle.r * 2) + 80))
            .attr('x', (d)=>(isRootNode(d) ? _configHolder.nodes.root.rect.x : -_configHolder.nodes.child.circle.r))
            .attr('y', (d)=>(isRootNode(d) ? _configHolder.nodes.root.rect.y : -_configHolder.nodes.child.circle.r));

        let buttonsGroup = ghostNode.append('g')
            .attr('class', 'buttons');
        appendElements(buttonsGroup, _configHolder.nodes.buttongroup);

        let buttonAdd = buttonsGroup.append('g')
            .attr('class', 'button button-add')
            .on('click', onAddChildClick);
        appendElements(buttonAdd, _configHolder.nodes.buttonAdd);
    }

    function drawDropZoneGroup() {
        showDropzones();

        let dropZoneData = _dropZoneGroup.selectAll('g.dropzone-group-node')
            .data(_d3DataHolder.nodes, (d)=>(`dropzone-${d.data._id}`));

        let dropZoneGroup = dropZoneData
            .enter()
            .append('g')
            .attr('id', (d)=>(`dropzone-group-node-${d.data._id}`))
            .attr('class', 'dropzone-group-node')
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y})`));
        dropZoneData
            .transition()
            .duration(_configHolder.transition)
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y})`));
        dropZoneData.exit().remove();

        appendElement(dropZoneGroup.filter(isRootNode), 'rect', Object.assign({},
            _configHolder.nodes.root.rect,
            // expand above by 7
            {x: -132, y: -57, rx: 57, ry: 57, width: 264, height: 114, class: 'dropzone dropzone-self'}));
        appendElement(dropZoneGroup.filter(isChildNode), 'circle', Object.assign({},
            _configHolder.nodes.child.circle,
            {transform: (d) => (`scale(${d.data.isCluster() ? 1.5 : 1.15})`), class: 'dropzone dropzone-self'}));
        appendElements(dropZoneGroup.filter(isChildNode), _configHolder.nodes.dropzonePrev);
        appendElements(dropZoneGroup.filter(isChildNode), _configHolder.nodes.dropzoneNext);

        dropZoneData.select('.dropzone-self')
            .attr('id', (d)=>(`dropzone-self-${d.data._id}`))
            .attr('parentId', (d) => (d.data._id))
            .attr('targetIndex', -1);
        dropZoneData.select('.dropzone-prev')
            .attr('id', (d)=>(`dropzone-prev-${d.data._id}`))
            .attr('parentId', (d) => (d.data.parent ? d.data.parent._id : ''))
            .attr('targetIndex', (d) => (d.data.parent ? d.data.parent.children.indexOf(d.data) : -1));
        dropZoneData.select('.dropzone-next')
            .attr('id', (d)=>(`dropzone-next-${d.data._id}`))
            .attr('parentId', (d) => (d.data.parent ? d.data.parent._id : ''))
            .attr('targetIndex', (d) => (d.data.parent ? d.data.parent.children.indexOf(d.data) + 1 : -1));

        dropZoneData.selectAll('.dropzone')
            // D3 drag
            .on('mouseenter', (d) => onDragOver(d))
            .on('mouseleave', (d) => onDragLeave(d))
            // Palette drag
            .on('dragover', (d) => {
                // We prevent the default to mark this dropzone as valid. Not doing so means that the "drop" event won't be fired.
                d3.event.preventDefault();
                onDragOver(d);
            })
            .on('dragleave', (d) => onDragLeave(d))
            .on('drop', (d) => onExternalDrop(d));

        _nodeGroup.selectAll('.node-entity')
            .classed('dropzone', true)
            .attr('parentId', (d)=>(d.data._id))
            .attr('targetIndex', -1)
            // D3 drag
            .on('mouseenter', (d) => (onDragOver(d, `dropzone-self-${d.data._id}`)))
            .on('mouseleave', (d) => (onDragLeave(d, `dropzone-self-${d.data._id}`)))
            // Palette drag
            .on('dragover', (d) => {
                // We prevent the default to mark this dropzone as valid. Not doing so means that the "drop" event won't be fired.
                d3.event.preventDefault();
                onDragOver(d, `dropzone-self-${d.data._id}`);
            })
            .on('dragleave', (d) => (onDragLeave(d, `dropzone-self-${d.data._id}`)))
            .on('drop', (d) => onExternalDrop(d, `dropzone-self-${d.data._id}`));
    }

    function drawSpecNodeGroup() {
        let specNodeData = _specNodeGroup.selectAll('g.spec-node')
            .data(_d3DataHolder.nodes.filter((node)=>{
                return !!node.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC);
            }), (d)=>(`spec-node-${d.data._id}`));
        let specNodeGroup = specNodeData
            .enter()
            .append('g')
            .attr('id', (d)=>(`spec-node-${d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC)._id}`))
            .attr('class', 'spec-node')
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y})`));
        specNodeData.transition()
            .duration(_configHolder.transition)
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y}) rotate(${d.data.hasChildren() ? -45 : 0})`));
        specNodeData.exit()
            .transition()
            .duration(_configHolder.transition)
            .attr('opacity', 0)
            .remove();

        specNodeGroup.append('polygon')
            .attr('class', 'node-memberspec-link')
            .attr('points', (d)=> {
                let left = _configHolder.nodes.memberspec.circle.r * -1;
                let right = _configHolder.nodes.memberspec.circle.r;
                let bottom = _configHolder.nodes.memberspec.circle.cy;
                return `0,0 ${right},${bottom} ${left},${bottom}`;
            })
            .attr('transform', 'scale(0)');
        specNodeData.select('polygon')
            .transition()
            .duration(_configHolder.transition)
            .attr('transform', 'scale(1)');

        let specNode = specNodeGroup.append('g')
            .attr('class', 'node-memberspec entity')
            .attr('id', (d)=>(`entity-${d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC)._id}`))
            .attr('transform-origin', `0 ${_configHolder.nodes.memberspec.circle.cy}`)
            .attr('transform', 'scale(0)')
            .on('click', (d)=>(onEntityClick({data: d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC)})));
        specNodeData.select('.node-memberspec')
            .classed('has-issues', (d)=>(d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC).hasIssues()))
            .classed('loading', (d)=>(d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC).miscData.get('loading')));
        specNodeData.select('.node-memberspec')
            .transition()
            .duration(_configHolder.transition)
            .attr('transform', 'scale(1)');
        appendElements(specNode, _configHolder.nodes.memberspec);
        specNodeData.select('image')
            .transition()
            .duration(_configHolder.transition)
            .attr('opacity', (d)=>(d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC).hasIcon() ? 1 : 0))
            .attr('xlink:href', (d)=>(d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC).icon));
    }

    function appendElements(node, definition) {
        let elements = [];
        Object.keys(definition).forEach((tag)=> {
            let properties = definition[tag];
            let element = appendElement(node, tag, properties);
            elements.push(element);
        });
        return elements;
    }

    function appendElement(node, tag, properties) {
        let element = node.append(tag);
        Object.keys(properties).forEach((property)=> {
            element.attr(property, properties[property]);
        });
        return element;
    }

    /**
     * Calculate the X coordinate of a policies/enricher to place it on the grid
     *
     * @param d the current {entity}
     * @param i the index
     * @returns {number} The X coordinate within the grid
     */
    function getGridX(d, i) {
        let nodeWidth = isRootNode(d.parent) ? _configHolder.nodes.root.rect.width : _configHolder.nodes.child.circle.r * 2;
        let offset = (_configHolder.nodes.adjunct.rect.width + _configHolder.grid.gutter) * Math.floor(i / _configHolder.grid.itemPerCol);
        if (d.parent.isCluster()) {
            offset += 20;
        }

        return _configHolder.grid.gutter + (nodeWidth/2) + offset;
    }

    /**
     * Calculate the Y coordinate of a policies/enricher to place it on the grid
     *
     * @param d the current {entity}
     * @param i the index
     * @returns {number} The Y coordinate within the grid
     */
    function getGridY(d, i) {
        let nodeHeight = isRootNode(d.parent) ? _configHolder.nodes.root.rect.height : _configHolder.nodes.child.circle.r * 2;
        let columnHeight = _configHolder.nodes.adjunct.rect.height * _configHolder.grid.itemPerCol + _configHolder.grid.gutter * (_configHolder.grid.itemPerCol - 1);
        let offset = nodeHeight > columnHeight ? (nodeHeight - columnHeight) / 2 : 0;

        return (_configHolder.nodes.adjunct.rect.height + _configHolder.grid.gutter) * (i%_configHolder.grid.itemPerCol) - (nodeHeight/2) + offset;
    }

    /**
     * Calculate the center coordinates of a policies/enricher to place it on the grid
     *
     * @param d the current {entity}
     * @param i the index
     * @returns {number} The center coordinates within the grid
     */
    function getGridItemCenter(d, i) {
        let centerX = getGridX(d, i) + _configHolder.nodes.adjunct.rect.width / 2;
        let centerY = getGridY(d, i) + _configHolder.nodes.adjunct.rect.height / 2;
        return `${centerX} ${centerY}`;
    }

    /**
     * Center the graph in the view, considering palette
     */
    function center() {
        let newX = window.innerWidth/2 + (window.innerWidth > 660 ? 220 : 0);
        let newY = _configHolder.nodes.child.circle.r + (_configHolder.nodes.child.circle.r * 2);
        zoom.translateBy(_svg, newX, newY);
        return this;
    }

    function trimNodeText(d) {
        if (!d.data.metadata.has('name') || d.data.metadata.get('name').length === 0) {
            return 'New application';
        } else {
            let name = d.data.metadata.get('name');
            return name.length > _configHolder.nodes.root.maxNameLength ? name.substring(0, _configHolder.nodes.root.maxNameLength) + '...' : name
        }
    }

    function isRootNode(d) {
        return d.depth === 0;
    }

    function isChildNode(d) {
        return d.depth > 0;
    }

    function getImportantAdjuncts(d) {
        let adjuncts = d.data.getPoliciesAsArray().concat(d.data.getEnrichersAsArray());
        return adjuncts.filter((adjunct)=>(adjunct.miscData.has('important') && adjunct.miscData.get('important') === true));
    }

    function selectNode(id) {
        _svg.selectAll('.entity.selected').classed('selected', false);
        _svg.selectAll('.relation.highlight').classed('highlight', false);
        _svg.select(`#entity-${id}`).classed('selected', true);
        _svg.selectAll(`.relation[from='${id}']`).classed('highlight', true);
        _svg.selectAll(`.relation[to='${id}']`).classed('highlight', true);
        return this;
    }

    function unselectNode() {
        _svg.selectAll('.entity.selected').classed('selected', false);
        _svg.selectAll('.relation.highlight').classed('highlight', false);
        return this;
    }

    /**
     * Hide the relationships for the dragged entity and its descendants
     * @param node the node for the dragged entity
     */
    function hideRelationships(node) {
        _d3DataHolder.relationships
            .filter(r => r.source.hasAncestor(node.data) || r.target.hasAncestor(node.data))
            .forEach(r => {
                _relationGroup.selectAll(`.relation[from='${r.source._id}'][to='${r.target._id}']`).classed('hidden', true);
            });
    }

    /**
     * Shows all relationships
     */
    function showRelationships() {
        _relationGroup.selectAll('.relation').classed('hidden', false);
    }

    /**
     * Hide the invalid dropzones for the dragged node
     * @param node the node that is being dragged
     */
    function hideInvalidDropzones(node) {
        _d3DataHolder.nodes
            .filter(d => d.data.hasAncestor(node.data))
            .forEach(d => {
                _dropZoneGroup.selectAll(`#dropzone-group-node-${d.data._id} .dropzone`).classed('hidden', true);
                _dropZoneGroup.selectAll(`.dropzone-prev[parentId='${d.data.parent._id}'][targetIndex='${d.data.parent.children.indexOf(d.data)+1}']`).classed('hidden', true);
                _dropZoneGroup.selectAll(`.dropzone-next[parentId='${d.data.parent._id}'][targetIndex='${d.data.parent.children.indexOf(d.data)}']`).classed('hidden', true);
            });
    }

    /**
     * Shows all dropzones
     */
    function showDropzones() {
        _dropZoneGroup.selectAll('.dropzone').classed('hidden', false);
    }

    // register global key events
    d3.select('body').on('keyup.body', onKeyUp);

    return {
        draw: draw,
        update: update,
        center: center,
        select: selectNode,
        unselect: unselectNode
    };
}
