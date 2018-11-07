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
import {ISSUE_LEVEL} from './model/issue.model';

export function D3BlueprintAbstract(container) {
    var bp = this;
    let result = {};
    
    let _svg = bp._svg = d3.select(container).append('svg').attr('class', 'blueprint-canvas');
    let _mirror = bp._mirror = _svg.append('path').style('display', 'none');
    let _zoomGroup = bp._zoomGroup = _svg.append('g').attr('class', 'zoom-group');
    let _parentGroup = bp._parentGroup = _zoomGroup.append('g').attr('class', 'parent-group');
    let _linkGroup = bp._linkGroup = _parentGroup.append('g').attr('class', 'link-group');
    let _relationGroup = bp._relationGroup = _parentGroup.append('g').attr('class', 'relation-group');
    let _specNodeGroup = bp._specNodeGroup = _parentGroup.append('g').attr('class', 'spec-node-group');
    let _dropZoneGroup = bp._dropZoneGroup = _parentGroup.append('g').attr('class', 'dropzone-group');
    let _ghostNodeGroup = bp._ghostNodeGroup = _parentGroup.append('g').attr('class', 'ghost-node-group');
    let _nodeGroup = bp._nodeGroup = _parentGroup.append('g').attr('class', 'node-group');
    let _cloneGroup = bp._cloneGroup = _parentGroup.append('g').attr('class', 'clone-group');

    let _dragState = bp._dragState = {
        dragInProgress: false,
        dragStarted: false,
        clone: null,
        cloneX: 0,
        cloneY: 0,
    };

    const config = bp.config = {};

    let d3data = bp.d3data = {
        nodes: [],
        ghostNodes: [],
        orphans: [],
        links: [],
        relationships: [],
    };

    let zoom = bp.zoom = d3.zoom().scaleExtent([0.1, 1]).on('zoom', onSvgZoom);
    
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
        // fill colour set by CSS; no stroke wanted
        .attr('d', 'M 1 3 h1 v1 H1 V3 z  m 2 -2 h1 v1 H3 V1 z');

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
            hideInvalidDropZones(node);

            d3.event.sourceEvent.preventDefault(); // disable browser text selection
            d3.event.sourceEvent.stopPropagation();
            _dragState.dragInProgress = true;
            // at this point, we still don't know if this will be a click or a real drag
            // so we defer the visual effects to the first 'dragging' event
            _dragState.dragStarted = true;
            let entityId = node.data._id;
            let mouseCoords = d3.mouse(_nodeGroup.select(`#entity-${node.data._id}`).node());
            // would be more normal not to add child sizes and mouseCoords
            // (so cursor stays in the same position relative to the dragged item as where the user clicks)
            // but that breaks the code for dropping/hovering when moving items
            _dragState.cloneX = node.x + config.child.width/2 + mouseCoords[0];
            _dragState.cloneY = node.y + config.child.height/2 + mouseCoords[1];
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
                    showDropZones();
                }, config.global.transitionDuration);
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
    bp.update = (blueprint, relationships) => {
        bp.config.global.updateLayout(blueprint, relationships, d3data);
        return result;
    }

    /**
     * Redraw the graph
     */
    bp.draw = () => {
        bp.drawLinks();
        bp.drawRelationships();
        bp.drawNodeGroup();
        bp.drawSpecNodeGroup();
        bp.drawGhostNode();
        bp.drawDropZoneGroup();
        return result;
    }

    bp.drawNodeGroup = () => {
        let nodeData = _nodeGroup.selectAll('g.node')
            .data(bp.d3data.nodes, (d)=>(`node-${d.data._id}`));

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
            .duration(config.global.transitionDuration)
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y}) scale(1)`))
            .attr('opacity', 1);
        nodeData.exit()
            .transition()
            .duration(config.global.transitionDuration)
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
        appendElements(entity.filter(isRootNode), config.root);
        
        nodeData.filter(isRootNode).select('.node-entity text')
            .text(trimRootNodeText)
            .transition()
            .duration(config.global.transitionDuration)
            .text(trimRootNodeText);
        nodeData.filter(isChildNode).select('.node-entity image')
            .transition()
            .duration(config.global.transitionDuration)
            .attr('opacity', (d)=>(d.data.hasIcon() ? 1 : 0))
            .attr('xlink:href', (d)=>(d.data.icon));

        // Draw child nodes
        appendElements(entity.filter(isChildNode).selectAll('circle').data([2, 1, 0]).enter(), config.child);

        // Draw location
        // -----------------------------------------------------
        let location = nodeGroup.append('g')
            .attr('class', 'node-location')
            .classed('loading', (d)=>(d.data.miscData.get('loading')));
        nodeData.select('g.node-location')
            .transition()
            .duration(config.global.transitionDuration)
            .attr('opacity', (d)=>(d.data.hasLocation() ? 1 : 0));
        appendElements(location, config.location);
        nodeData.select('g.node-location image')
            .transition()
            .duration(config.global.transitionDuration)
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
            .duration(config.global.transitionDuration)
            .attr('x', bp.getAdjunctGridX)
            .attr('y', bp.getAdjunctGridY)
            .attr('transform', 'scale(1)')
            .attr('transform-origin', bp.getAdjunctGridItemCenter);
        adjunctData.exit()
            .transition()
            .duration(config.global.transitionDuration)
            .attr('transform', 'scale(0)')
            .remove();
        appendElements(adjunctData.enter(), config.adjunct);
    };

    bp.drawLinks = () => {
        let link = _linkGroup.selectAll('line.link')
            .data(bp.d3data.links, (d)=>(d.source.data._id + '_to_' + d.target.data._id));

        link.enter().insert('line')
            .attr('class', 'link')
            .attr('x1', (d)=>(d.source.x))
            .attr('y1', (d)=>(d.source.y))
            .attr('x2', (d)=>(d.source.x))
            .attr('y2', (d)=>(d.source.y));
        link.transition()
            .duration(config.global.transitionDuration)
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
        let node = bp.d3data.nodes.find(d => {
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

    bp.drawRelationships = () => {
        showRelationships();

        let relationData = _relationGroup.selectAll('.relation')
            .data(bp.d3data.relationships, (d)=>(d.source._id + '_related_to_' + d.target._id));

        relationData.enter().insert('path')
            .attr('class', 'relation')
            .attr('opacity', 0)
            .attr('from', (d)=>(d.source._id))
            .attr('to', (d)=>(d.target._id));
        relationData.transition()
            .duration(config.global.transitionDuration)
            .attr('opacity', 1)
            .attr('stroke', 'red')
            .attr('d', function(d) {
                let targetNode = nodeForEntity(d.target);
                let sourceNode = nodeForEntity(d.source);
                let sourceX = sourceNode.x + (d.source.isMemberSpec() ? config.memberspec.deltaX : 0);
                let targetX = targetNode.x + (d.target.isMemberSpec() ? config.memberspec.deltaX : 0);
                let sourceY = sourceNode.y + (d.source.isMemberSpec() ? config.memberspec.deltaY : 0);
                let targetY = targetNode.y + (d.target.isMemberSpec() ? config.memberspec.deltaY : 0);
                let dx = targetX - sourceX;
                let dy = targetY - sourceY;
                let dr = Math.sqrt(dx * dx + dy * dy);
                let sweep = dx * dy > 0 ? 0 : 1;
                
                _mirror.attr('d', `M ${sourceX},${sourceY} A ${dr},${dr} 0 0,${sweep} ${targetX},${targetY}`);
                let m = _mirror._groups[0][0].getPointAtLength(_mirror._groups[0][0].getTotalLength() - config.child.radius - 20);

                dx = m.x - sourceNode.x;
                dy = m.y - sourceY;
                dr = Math.sqrt(dx * dx + dy * dy);

                return `M ${sourceNode.x},${sourceY} A ${dr},${dr} 0 0,${sweep} ${m.x},${m.y}`;
            });
        relationData.exit()
            .transition()
            .duration(config.global.transitionDuration)
            .attr('opacity', 0)
            .remove();
    }

    bp.drawGhostNode = () => {
        let ghostNodeData = _ghostNodeGroup.selectAll('g.ghost-node')
            .data(bp.d3data.nodes, (d)=>(`ghost-node-${d.data._id}`));
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
            .duration(config.global.transitionDuration)
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y})`));
        ghostNodeData.exit().remove();

        ghostNode.append('rect')
            .attr('class', 'ghost')
            .attr('width', bp.config.global.nodeWidth)
            .attr('height', (d)=>(bp.config.global.nodeHeight(d) + 80))
            .attr('x', (d)=>(-bp.config.global.nodeWidth(d)/2))
            .attr('y', (d)=>(-bp.config.global.nodeHeight(d)/2));

        let buttonsGroup = ghostNode.append('g')
            .attr('class', 'buttons');
        appendElements(buttonsGroup, config.buttongroup);

        let buttonAdd = buttonsGroup.append('g')
            .attr('class', 'button button-add')
            .on('click', onAddChildClick);
        appendElements(buttonAdd, config.buttonAdd);
    }

    bp.drawDropZoneGroup = () => {
        showDropZones();

        let dropZoneData = _dropZoneGroup.selectAll('g.dropzone-group-node')
            .data(bp.d3data.nodes, (d)=>(`dropzone-${d.data._id}`));

        let dropZoneGroup = dropZoneData
            .enter()
            .append('g')
            .attr('id', (d)=>(`dropzone-group-node-${d.data._id}`))
            .attr('class', 'dropzone-group-node')
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y})`));
        dropZoneData
            .transition()
            .duration(config.global.transitionDuration)
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y})`));
        dropZoneData.exit().remove();

        appendElement(dropZoneGroup.filter(isRootNode), bp.config.root.shape, bp.config.root.dropOverrides);
        appendElement(dropZoneGroup.filter(isChildNode), bp.config.child.shape, bp.config.child.dropOverrides);
        appendElements(dropZoneGroup.filter(isChildNode), config.dropzonePrev);
        appendElements(dropZoneGroup.filter(isChildNode), config.dropzoneNext);

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

    bp.drawSpecNodeGroup = () => {
        let specNodeData = _specNodeGroup.selectAll('g.spec-node')
            .data(bp.d3data.nodes.filter((node)=>{
                return !!node.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC);
            }), (d)=>(`spec-node-${d.data._id}`));
        let specNodeGroup = specNodeData
            .enter()
            .append('g')
            .attr('id', (d)=>(`spec-node-${d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC)._id}`))
            .attr('class', 'spec-node')
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y})`));
        specNodeData.transition()
            .duration(config.global.transitionDuration)
            .attr('transform', (d)=>(`translate(${d.x}, ${d.y}) rotate(${d.data.hasChildren() ? -45 : 0})`));
        specNodeData.exit()
            .transition()
            .duration(config.global.transitionDuration)
            .attr('opacity', 0)
            .remove();

        specNodeGroup.append('polygon')
            .attr('class', 'node-memberspec-link')
            .attr('points', (d)=> {
                let left = config.memberspec.deltaX + -config.memberspec.width/2;
                let right = config.memberspec.deltaX + config.memberspec.width/2;
                let bottom = config.memberspec.deltaY;
                return `0,0 ${right},${bottom} ${left},${bottom}`;
            })
            .attr('transform', 'scale(0)');
        specNodeData.select('polygon')
            .transition()
            .duration(config.global.transitionDuration)
            .attr('transform', 'scale(1)');

        let specNode = specNodeGroup.append('g')
            .attr('class', 'node-memberspec entity')
            .attr('id', (d)=>(`entity-${d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC)._id}`))
            .attr('transform-origin', `${config.memberspec.deltaX} ${config.memberspec.deltaY}`)
            .attr('transform', 'scale(0)')
            .on('click', (d)=>(onEntityClick({data: d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC)})));
        specNodeData.select('.node-memberspec')
            .classed('has-issues', (d)=>(d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC).hasIssues()))
            .classed('loading', (d)=>(d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC).miscData.get('loading')));
        specNodeData.select('.node-memberspec')
            .transition()
            .duration(config.global.transitionDuration)
            .attr('transform', 'scale(1)');
        appendElements(specNode, config.memberspec);
        specNodeData.select('image')
            .transition()
            .duration(config.global.transitionDuration)
            .attr('opacity', (d)=>(d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC).hasIcon() ? 1 : 0))
            .attr('xlink:href', (d)=>(d.data.getClusterMemberspecEntity(PREDICATE_MEMBERSPEC).icon));
    }

    let appendElements = bp.appendElements = (node, definition) => {
        return Object.keys(definition).reduce( (elements, tagId) => {
            elements.push(appendElement(node, definition[tagId]));
            return elements;
        }, []);
    };

    let appendElement = bp.appendElement = (node, properties, overrides) => {
        let tag = properties.tag;
        let attrs = properties.attrs;
        if (!tag || !attrs) return;
        return Object.keys( Object.assign({}, overrides, attrs) ).reduce((element, property)=> {
            let val = attrs[property];
            let override = overrides ? overrides[property] : null;
            if (override) {
                if (typeof override === 'function') {
                    let ov = val;
                    if (typeof val === 'function') {
                        val = (d) => override(ov(d), d);
                    } else {
                        val = (d) => override(ov, d);
                    }
                } else {
                    val = override;
                }
            }
            return element.attr(property, val);
        }, node.append(tag));
    };

    /**
     * Calculate the X coordinate of a policies/enricher to place it on the adjunct grid
     *
     * @param d the current {entity}
     * @param i the index
     * @returns {number} The X coordinate within the grid
     */
    bp.getAdjunctGridX = (d, i) => {
        let nodeWidth = bp.config.global.nodeWidth(d.parent);
        let offset = (config.adjunct.width + config.adjunct.gutterSize) * Math.floor(i / config.adjunct.itemPerCol);
        if (d.parent.isCluster()) {
            offset += 20;
        }

        return config.adjunct.gutterSize + (nodeWidth/2) + offset;
    };

    /**
     * Calculate the Y coordinate of a policies/enricher to place it on the adjunct grid
     *
     * @param d the current {entity}
     * @param i the index
     * @returns {number} The Y coordinate within the grid
     */
    bp.getAdjunctGridY = (d, i) => {
        let nodeHeight = bp.config.global.nodeHeight(d.parent);
        let columnHeight = config.adjunct.height * config.adjunct.itemPerCol + config.adjunct.gutterSize * (config.adjunct.itemPerCol - 1);
        let offset = nodeHeight > columnHeight ? (nodeHeight - columnHeight) / 2 : 0;

        return (config.adjunct.height + config.adjunct.gutterSize) * (i%config.adjunct.itemPerCol) - (nodeHeight/2) + offset;
    };

    /**
     * Calculate the center coordinates of a policies/enricher to place it on the adjunct grid
     *
     * @param d the current {entity}
     * @param i the index
     * @returns {number} The center coordinates within the grid
     */
    bp.getAdjunctGridItemCenter = (d, i) => {
        let centerX = getGridX(d, i) + config.adjunct.width / 2;
        let centerY = getGridY(d, i) + config.adjunct.height / 2;
        return `${centerX} ${centerY}`;
    };

    /**
     * Center the graph in the view, considering palette
     */
    let center = bp.center = () => {
        let newX = window.innerWidth/2 + (window.innerWidth > 660 ? 220 : 0);
        let newY = config.child.height * 3/2;
        zoom.translateBy(_svg, newX, newY);
        return result;
    }

    let trimRootNodeText = bp.trimRootNodeText = (d) => {
        if (!d.data.metadata.has('name') || d.data.metadata.get('name').length === 0) {
            return 'New application';
        } else {
            let name = d.data.metadata.get('name');
            return name.length > config.root.maxNameLength ? name.substring(0, config.root.maxNameLength) + '...' : name
        }
    }

    let isRootNode = bp.isRootNode = (d) => d.depth === 0;
    
    let isChildNode = bp.isChildNode = (d) => d.depth > 0;

    let getImportantAdjuncts = bp.getImportantAdjuncts = (d) =>
        [].concat(d.data.getPoliciesAsArray()).concat(d.data.getEnrichersAsArray())
            .filter( (adjunct)=>(adjunct.miscData.has('important') && adjunct.miscData.get('important') === true) );

    let selectNode = bp.selectNode = (id) => {
        _svg.selectAll('.entity.selected').classed('selected', false);
        _svg.selectAll('.relation.highlight').classed('highlight', false);
        _svg.select(`#entity-${id}`).classed('selected', true);
        _svg.selectAll(`.relation[from='${id}']`).classed('highlight', true);
        _svg.selectAll(`.relation[to='${id}']`).classed('highlight', true);
        return result;
    };

    let unselectNode = bp.unselectNode = () => {
        _svg.selectAll('.entity.selected').classed('selected', false);
        _svg.selectAll('.relation.highlight').classed('highlight', false);
        return result;
    };

    /**
     * Hide the relationships for the dragged entity and its descendants
     * @param node the node for the dragged entity
     */
    let hideRelationships = bp.hideRelationships = (node) => {
        bp.d3data.relationships
            .filter(r => r.source.hasAncestor(node.data) || r.target.hasAncestor(node.data))
            .forEach(r => {
                _relationGroup.selectAll(`.relation[from='${r.source._id}'][to='${r.target._id}']`).classed('hidden', true);
            });
    };

    /**
     * Shows all relationships
     */
    let showRelationships = bp.showRelationships = () => {
        _relationGroup.selectAll('.relation').classed('hidden', false);
    };

    /**
     * Hide the invalid dropzones for the dragged node
     * @param node the node that is being dragged
     */
    let hideInvalidDropZones = bp.hideInvalidDropZones = (node) => {
        d3data.nodes
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
    let showDropZones = bp.showDropZones = () => {
        _dropZoneGroup.selectAll('.dropzone').classed('hidden', false);
    };

    // register global key events
    d3.select('body').on('keyup.body', onKeyUp);

    // public signature
    Object.assign(result, {
        draw: bp.draw,
        update: bp.update,
        center: bp.center,
        select: bp.selectNode,
        unselect: unselectNode
    });
    return result;
}
