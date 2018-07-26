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

import * as d3 from "d3";

export function isNewEntity(d) {
  return d.data.task && d.parent && d.parent.data.task && d.data.task.entityId && d.data.task.entityId != d.parent.data.task.entityId;
}

export function isInProgress(d) {
    var t = findTask(d);
    return (t.startTimeUtc && !t.endTimeUtc);
}

export function taskClasses(d, classes) {
  if (!classes) classes = [];
  if (typeof classes === "string") classes = [ classes ];
  if (!d) return classes;
  if (!d.id) return taskClasses(d.data || d.task, classes);
  classes.push("task");
  if (!d.startTimeUtc) classes.push("unstarted");
  else {
    classes.push("started");
    if (!d.endTimeUtc) classes.push("in-progress");
    else classes.push("completed");
  }
  return classes;
}

export function orderFn(d1, d2) {
    function orderFnHelper(x1, x2) {
        if (x1 && x2) return x2 - x1;
        // if no value, it comes _after_
        if (x2) return -1;
        if (x1) return 1;
        return 0;
    }
    // use start time if avail
    var dd1 = d1['data'] || d1;
    var t1 = dd1['task'] || {};
    var dd2 = d2['data'] || d2;
    var t2 = dd2['task'] || {};
    var result = orderFnHelper(t1['startTimeUtc'], t2['startTimeUtc']);
    if (result) return result;
    result = orderFnHelper(t1['submitTimeUtc'], t2['submitTimeUtc']);
    if (result) return result;
    result = orderFnHelper(t1['endTimeUtc'], t2['endTimeUtc']);
    if (result) return result;
    
    return orderFnHelper(dd1['sequenceId'], dd2['sequenceId']);
}

var colors;
colors = {
  ERROR: d3.color(__BRAND_DANGER__ || "#B43"),
  ACTIVE_NORMAL: d3.color(__BRAND_SUCCESS__ || "#090")
};
{
    // build a palette to use, avoiding anything that looks like success
    // (danger we don't avoid as it is usually bright)
    var hueToAvoid = d3.hsl(colors.ACTIVE_NORMAL).h;
    var palette = [];
    var i = 0;
    while (i<360) {
        if ((i-hueToAvoid+360)%360 < 45 || (i-hueToAvoid+360)%360>360-45) {
            // skip hues near the hue to avoid
        } else {
            palette.push(d3.hsl(i, 0.6, 0.2));
        }
        // hue change more significant for colours at bottom of palette so larger increment above 96
        if (i>=96) i+=12;
        i+=6;
    }
    colors.PALETTE = palette;
}
Object.assign(colors, colors, {
  ACTIVE_DARK: colors.ACTIVE_NORMAL.darker(0.4),
  ACTIVE_BRIGHT: colors.ACTIVE_NORMAL.brighter(0.2),
  scale: 
    function(x) {
      return colors.PALETTE[((hash(x) % colors.PALETTE.length)+colors.PALETTE.length)%colors.PALETTE.length];
    },
  nodeToUseForHue: function(x) {
    return x;
    // one trick is for completed leaf nodes to all get their parent's colour to make it look tidier
    // return (findTask(x.parent).id && !x.children) ? x.parent : x;
  },
  nodeName: function(x) { return (x.data && x.data.name) || x.displayName || x; },
  succeededFn: function(x) { return colors.scale(colors.nodeName(x)); },
  unstartedFn: function(x) { 
    var base = d3.hsl(colors.succeededFn(x));
    base.s = 0.3;
    base.l = 0.9;
    return base;
  },
  f: function(x) {
    var t = findTask(x);
    if (t.isError) return colors.ERROR;
    if (t.endTimeUtc) return colors.succeededFn(colors.nodeToUseForHue(x)).toString();
    if (t.startTimeUtc) return colors.ACTIVE_NORMAL;
    return colors.unstartedFn(colors.nodeToUseForHue(x)).toString();
  }
}); 
colors.ACTIVE_ANIMATE_VALUES = [ colors.ACTIVE_NORMAL, colors.ACTIVE_DARK, colors.ACTIVE_NORMAL, colors.ACTIVE_BRIGHT, colors.ACTIVE_NORMAL].join(";");
// just in case someone wants to set the colors
function setColors(newColors) { colors = newColors; }

export function colors() { return colors; }

export function findTask(x) {
    if (!x) return {};
    if (x.id) return x;
    if (x.task) return x.task;
    if (x.data) return findTask(x.data);
    return {};
}

export function hash(x) {
  if (!x) return 0;
  if (typeof x !== "string") return hash(x.toString());
  var hash = 0, i;
  if (x.length === 0) return hash;
  for (i = 0; i < x.length; i++) {
    hash  = ((hash << 5) - hash) + x.charCodeAt(i) + 8765;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

/* returns a function which generates an arc for a d3 data object */
export function arcF(options) {
    if (!options || !options.scaling || !options.visible_arc_length) {
        throw "At minimum, scaling and visible_arc_length options are required";
    } 
    // if using for tweening 
    options.t = options.t==null ? 1 : options.t;
    options.visible_arc_start_fn = options.visible_arc_start_fn || (x => 0);

    // whether the arc should be really thin, or normal width
    options.isMinimal = options.isMinimal || false;
     
    options.visible_arc_length = options.visible_arc_length;
    
    // if tweening can also use this
    options.old_visible_arc_length = options.old_visible_arc_length || options.visible_arc_length;
    
    return d3.arc()
    .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, options.scaling.fx(d.x0))) *
          ( options.old_visible_arc_length * (1-options.t) + options.visible_arc_length * options.t ) +
        options.visible_arc_start_fn( options.old_visible_arc_length ) * 2 * Math.PI * (1-options.t) +
        options.visible_arc_start_fn( options.visible_arc_length ) * 2 * Math.PI * options.t; })
    .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, options.scaling.fx(d.x0 + options.t*(d.x1-d.x0)))) * 
          ( options.old_visible_arc_length * (1-options.t) + options.visible_arc_length * options.t ) +
        options.visible_arc_start_fn( options.old_visible_arc_length ) * 2 * Math.PI * (1-options.t) +
        options.visible_arc_start_fn( options.visible_arc_length ) * 2 * Math.PI * options.t; })
    .innerRadius(function(d) { return options.scaling.fy(d.depth-1); })
    .outerRadius(function(d) { return options.isMinimal ? options.scaling.fy(d.depth-1)+1.5 : options.scaling.fy(d.depth); });
}

export function taskId(d) { return findTask(d).id; }

export function id(x) { return x; }
          
