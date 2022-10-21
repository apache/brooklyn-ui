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
import template from "./workflow-steps.template.html";
import angular from "angular";

const MODULE_NAME = 'inspector.workflow-steps';

angular.module(MODULE_NAME, [])
    .directive('workflowSteps', workflowStepsDirective);

export default MODULE_NAME;

export function workflowStepsDirective() {
    return {
        template: template,
        restrict: 'E',
        scope: {
            workflow: '=',
            task: '=?',
        },
        controller: ['$sce', '$timeout', '$scope', '$element', controller],
        controllerAs: 'vm',
    };

    function controller($sce, $timeout, $scope, $element) {
        let vm = this;

        vm.stringify = stringify;

        vm.getWorkflowStepsClasses = () => {
            const c = [];
            c.push('workflow-status-'+$scope.workflow.data.status);
            if ($scope.workflow.data.status && $scope.workflow.data.status.startsWith('ERROR')) {
                c.push('workflow-error');
            }
            return c;
        }

        $scope.expandStates = {};
        if ($scope.workflow.tag && !_.isNil($scope.workflow.tag.stepIndex)) {
            $scope.expandStates[$scope.workflow.tag.stepIndex] = true;
        }

        vm.onSizeChange = () => $timeout(()=>recompute($scope, $element));

        $scope.$watch('workflow', vm.onSizeChange);
        vm.onSizeChange();
    }

    function recompute($scope, $element) {
        let svg = $element[0].querySelector('#workflow-step-arrows');

        let steps = $element[0].querySelectorAll('div');
        // let steps = $element[0].querySelectorAll('.workflow-steps-main');
        steps = $element[0].querySelectorAll('.workflow-step');
        let arrows = makeArrows($scope.workflow, steps);

        svg.innerHTML = arrows.join('\n');
    }
}

function makeArrows(workflow, steps) {
    workflow = workflow || {};
    workflow.data = workflow.data || {};

    let [stepsPrev,stepsNext] = getWorkflowStepsPrevNext(workflow);

    const arrows = [];
    const strokeWidth = 1.5;
    const arrowheadLength = 6;
    const arrowheadWidth = arrowheadLength/3/strokeWidth;
    const defs = [];

    defs.push('<marker id="arrowhead" markerWidth="'+3*arrowheadWidth+'" markerHeight="'+3*arrowheadWidth+'" refX="'+0+'" refY="'+1.5*arrowheadWidth+'" orient="auto"><polygon fill="#000" points="0 0, '+3*arrowheadWidth+' '+1.5*arrowheadWidth+', 0 '+(3*arrowheadWidth)+'" /></marker><');
    defs.push('<marker id="arrowhead-gray" markerWidth="'+3*arrowheadWidth+'" markerHeight="'+3*arrowheadWidth+'" refX="'+0+'" refY="'+1.5*arrowheadWidth+'" orient="auto"><polygon class="fill-future" points="0 0, '+3*arrowheadWidth+' '+1.5*arrowheadWidth+', 0 '+(3*arrowheadWidth)+'" /></marker><');
    defs.push('<marker id="arrowhead-red" markerWidth="'+3*arrowheadWidth+'" markerHeight="'+3*arrowheadWidth+'" refX="'+0+'" refY="'+1.5*arrowheadWidth+'" orient="auto"><polygon class="fill-failed" points="0 0, '+3*arrowheadWidth+' '+1.5*arrowheadWidth+', 0 '+(3*arrowheadWidth)+'" /></marker><');

    if (steps) {
        let gradientCount = 0;
        function arrowSvg(y1, y2, opts) {
            var start = y1==='start/end';
            var end = y2==='start/end';

            if (y1==null || y2==null || (start&&end)) {
                // ignore if out of bounds
                return "";
            }

            if (!opts) opts = {};
            const color = opts.class ? '' : opts.color || (opts.colorEnd && opts.colorEnd==opts.colorStart ? opts.colorEnd : '#000');

            const rightFarEdge = 56;
            const rightArrowheadStart = rightFarEdge - arrowheadLength;
            const leftFarEdge = 10;
            const leftActive = rightArrowheadStart + (leftFarEdge - rightArrowheadStart) * (opts.width || 1);

            const curveX = opts.curveX || 1;
            const curveY = opts.curveY || 1;

            // const controlPointRightFarEdge = rightFarEdge + (leftActive - rightFarEdge) * curveX;
            const controlPointRightArrowheadStart = rightArrowheadStart + (leftActive - rightArrowheadStart) * curveX;
            // average of above two, to see which works best
            // const controlPointRightIntermediate = (rightFarEdge+rightArrowheadStart)/2 + (leftActive - (rightFarEdge+rightArrowheadStart)/2) * curveX;
            // const controlPointRightExaggerated = rightArrowheadStart + (leftActive - rightFarEdge) * curveX;
            const controlPointStart = controlPointRightArrowheadStart;
            const controlPointEnd = controlPointRightArrowheadStart;

            const strokeConstant = color ? 'stroke="'+color+'"' : ''

            let standard =
                'stroke-width="'+(opts.lineWidth || strokeWidth)+'" '+
                'fill="transparent" '+
                '/>';
            if (opts.class) standard = 'class="'+opts.class+'" '+standard;
            if (!opts.hideArrowhead) standard = 'marker-end="url(#'+(opts.arrowheadId || 'arrowhead')+')" ' +standard;
            if (opts.dashLength) standard = 'stroke-dasharray="'+opts.dashLength+'" '+standard;

            if (start) {
                return '<path d="M ' + leftFarEdge + ' ' + y2 +
                    ' L ' + rightArrowheadStart + ' ' + y2 + '" '+
                    strokeConstant+' '+standard;
            }
            if (end) {
                return '<path d="M ' + rightFarEdge + ' ' + y1 +
                    ' L ' + (leftFarEdge+arrowheadLength) + ' ' + y1 + '" '+
                    strokeConstant+' '+standard;
            }

            const yMCH = ((y2 - y1) / 2) * curveY;
            const yM = (y1 + y2) / 2;

            if (!opts.colorEnd || opts.colorEnd==opts.colorStart || y2==y1) {
                standard = strokeConstant + ' ' + standard;
            } else {
                const gradientId = 'gradient'+(gradientCount++);
                const gradY = y2>=y1 ? 'y2="1"' : 'y1="1"';
                defs.push('<linearGradient id="'+gradientId+'" x2="0" '+gradY+'><stop offset="0" stop-color="'+opts.colorStart+'"/><stop offset="1" stop-color="'+opts.colorEnd+'"/></linearGradient>');
                standard = 'stroke="url(#'+gradientId+')" ' + standard;
            }

            const result = '<path d="M ' + rightFarEdge + ' ' + y1 +
                // ' L ' + r0 + ' ' + y1 + ' ' +
                ' C ' + controlPointStart + ' ' + y1 + ', ' + leftActive + ' ' + (yM - yMCH) + ', ' + leftActive + ' ' + yM + ' ' +
                ' S ' + controlPointEnd + ' ' + y2 + ', ' + rightArrowheadStart + ' ' + y2 + '" '+standard;
            return result;
        }

        function stepY(n) {
            if (n==-1) return 'start/end';
            if (!steps || n<0 || n>=steps.length) {
                console.log("workflow arrow bounds error", steps, n);
                return null;
            }
            return steps[n].offsetTop + steps[n].offsetHeight / 2;
        }

        function arrowStep(n1, n2, opts) {
            let s1 = stepY(n1);
            let s2 = stepY(n2);

            const deltaForArrowMax = 6;
            const deltaForArrowTarget = 0.125;
            if (typeof s1 === "number") s1 += Math.min(steps[n1].offsetHeight * deltaForArrowTarget, deltaForArrowMax);
            if (typeof s2 === "number") s2 -= Math.min(steps[n2].offsetHeight * deltaForArrowTarget, deltaForArrowMax);
            return arrowSvg(s1, s2, opts);
        }

        let jumpSizes = {1: true};

        function arrowStep2(prev, i, opts) {
            let curveX = 0.5;
            let curveY = 0.75;
            let width = 0.5;
            if (prev==-1 || i==-1) {
                // curve values don't matter for start/end
            } else if (prev==i) {
                width = 0.15;
                curveX = 0.1;
                curveY = 0.75;
            } else {
                let rank = jumpSizes.indexOf(''+Math.abs(prev-i));
                if (rank<0) {
                    console.log("Missing workflow link: ", prev, i);
                    rank = 0;
                }
                if (prev > i) rank = rank + 0.5;
                width = 0.2 + 0.6 * (rank + 0.5) / (jumpSizes.length + 0.5);
                curveX = 0.8 + 0.2*width;
                curveY = 0.8 + 0.2*width;
                // higher values (above) look nicer, but make disambiguation of complex paths harder
                // curveX = 0.5 + 0.3*width;
                // curveY = 0.4 + 0.4*width;
            }
            return arrowStep(prev, i, {hideArrowhead: prev==i, width, curveX, curveY, ...opts});
        }

        function colorFor(step, references) {
            if (!references) return 'red';
            const i = references.indexOf(step);
            if (i==-1) return 'red';
            // skew quadratically for lightness
            const skewTowards1 = x => (1 - (1-x)*(1-x));
            let gray = Math.round(240 * skewTowards1(i / references.length) );
            return 'rgb('+gray+','+gray+','+gray+')';
        }

        let arrowSpecs = {};
        function recordTransition(from, to, opts) {
            if (to!=-1 && from!=-1 && to!=from) {
                jumpSizes[Math.abs(from-to)] = true;
            }
            if (arrowSpecs[[from,to]]) {
                // prefer earlier additions (real steps) over theoretical ones
            } else {
                arrowSpecs[[from, to]] = {from, to, ...(opts || {})};
            }
        }

        for (var i = -1; i < steps.length; i++) {
            const prevsHere = stepsPrev[i];
            if (prevsHere && prevsHere.length) {
                prevsHere.forEach(prev => {
                    // last in list has higher z-order; this ensures within each prevStep we preserve order,
                    // so inbound arrows are correct. currently we also prefer earlier steps, which isn't quite right for outbound arrows;
                    // ideally we'd reconstruct the flow order, but that's a bit more work than we want to do just now.
                    // so insertion point is always 0. (header items added at end so we don't need to include those here.)
                    recordTransition(prev, i, { insertionPoint: 0, visited: true, colorStart: colorFor(i, stepsNext[prev]), colorEnd: colorFor(prev, prevsHere) });
                });
            }
        }

        // now make pale arrows for the default flow
        var indexOfId = {};
        for (var i = 0; i < steps.length; i++) {
            const s = workflow.data.stepsDefinition[i];
            if (s.id) indexOfId[s.id] = i;
        }

        function isStepType(step, type) {
            if (!step) return false;
            if (step.type) return step.type == type;
            let s = step.startsWith ? step : step.s || step.shorthand || step.userSuppliedShorthand;
            if (s) return s == type || s.startsWith(type);
            return false;
        }

        for (var i = 0; i < steps.length; i++) {
            const s = workflow.data.stepsDefinition[i];

            let opts = { insertionPoint: 0 };
            if (workflow.data.currentStepIndex === i && workflow.data.status && workflow.data.status.startsWith('ERROR')) {
                recordTransition(i, -1, { ...opts, class: 'arrow-failed', arrowheadId: 'arrowhead-red' });
            }

            opts = { ...opts, class: 'arrow-future', arrowheadId: 'arrowhead-gray', dashLength: 8 };

            let next = null;
            if (s.next) {
                if (s.next.toLowerCase()=='end') next = -1;
                else if (indexOfId[s.next]) next = indexOfId[s.next];
            }
            if (isStepType(s, 'return')) next = -1;

            if (next!=null) {
                // special next per step
                recordTransition(i, next, opts);
                if (!s.condition) continue;
            }
            // if nothing special, or if was conditional, then go to next step
            // (only go forward 1, even if it is conditional, otherwise too many arrows)

            next = i+1;
            if (i + 1 >= steps.length) next = -1;
            recordTransition(i, next, opts);
        }

        jumpSizes = Object.keys(jumpSizes).sort();

        // insert arrows
        Object.values(arrowSpecs).forEach(arrowSpec =>
            arrows.splice(arrowSpec.insertionPoint || 0, 0, arrowStep2(arrowSpec.from, arrowSpec.to, arrowSpec)) );
        // then defs at start
        arrows.splice(0, 0, '<defs>'+defs.join('')+'</defs>');
    }
    return arrows;
}

function getWorkflowStepsPrevNext(workflow) {
    let stepsPrev = {}
    let stepsNext = {}

    if (workflow && workflow.data.oldStepInfo) {
        Object.entries(workflow.data.oldStepInfo).forEach(([k,v]) => {
            stepsPrev[k] = v.previous || [];
            stepsNext[k] = v.next || [];
        });
    }

    // mock data
    // // first in list is most recent
    // stepsPrev = {
    //     '-1': [ 3 ],
    //     0: [ -1 ],
    //     1: [ 0 ],
    //     2: [ 1 ],
    //     3: [ 2 ],
    // }
    // stepsNext = {
    //     '-1': [ 0 ],
    //     0: [ 1 ],
    //     1: [ 2 ],
    //     2: [ 3 ],
    //     3: [ -1 ],
    // }
    //
    // stepsPrev = {
    //     '-1': [ 2 ],
    //     0: [ -1 ],
    //     1: [ 1, 4, 0 ],
    //     2: [ 3, 1 ],
    //     3: [ 2 ],
    //     4: [ 1 ],
    // }
    // stepsNext = {
    //     '-1': [ 0 ],
    //     0: [ 1 ],
    //     1: [ 2, 1, 4, 0 ],
    //     2: [ -1, 3 ],
    //     3: [ 2 ],
    //     4: [ 1 ],
    // }

    // // even more complex
    // stepsPrev = {
    //     '-1': [ 2 ],
    //     0: [ 3, -1 ],
    //     1: [ 1, 4, 0 ],
    //     2: [ 3, 1 ],
    //     3: [ 2, 0 ],
    //     4: [ 1 ],
    // }
    // stepsNext = {
    //     '-1': [ 0 ],
    //     0: [ 1, 3 ],
    //     1: [ 2, 1, 4, 0 ],
    //     2: [ -1, 3 ],
    //     3: [ 2, 0 ],
    //     4: [ 1 ],
    // }

    return [stepsPrev, stepsNext];
}

function stringify(data) { return JSON.stringify(data, null, 2); }
