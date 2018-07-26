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
import angular from "angular";
import moment from "moment";
import * as d3 from "d3";
import * as util from "./task-sunburst.util";
import template from "./task-sunburst.template.html";

const MODULE_NAME = 'inspector.task-sunburst';

angular.module(MODULE_NAME, [])
    .directive('taskSunburst', taskSunburstDirective)

export default MODULE_NAME;

export function taskSunburstDirective() {
    return {
        template: template,
        restrict: 'E',
        scope: {
            tasks: '=',
            taskType: '@'
        },
        controller: ['$scope', '$element', '$state', '$window', controller]
    };

    function controller($scope, $element, $state, $window) {
        var viz = initVisualization($scope, $element, $state);

        angular.element($window).on('resize', viz.resize);
        $scope.$on('resize', viz.resize);
        
        $scope.$on('$destroy', function() {
            angular.element($window).off('resize', viz.resize);
        });

        $scope.$watch('tasks', function () {
            viz.prepData();
            viz.redraw();
        });
        
    }
}

// this could be its own class independent of angular in future
function initVisualization($scope, $element, $state) {

    var result = {};
    var tasksData;
    var tasksById;
        
    result.prepData = function() { 
        tasksData = {name: "root", task: null, children: []};
        
        tasksById = {};
        // accept array or map where values are the array
        // built a map with keys as the id, values a map wrapping the original task in key "task"
        // alongside keys name, parentId, children
        (Array.isArray($scope.tasks) ? $scope.tasks : Object.values($scope.tasks)).forEach(t => {
            if (t.tags.indexOf("SUB-TASK")>=0 || t.tags.indexOf("EFFECTOR")>=0) {
              tasksById[t.id] = { task: t, name: t.displayName };
            }
        });
        Object.values(tasksById).forEach((v,i) => {
          v.sequenceId = i;
          if (v.task.children) {
            // set this as the parent of all known children
            v.task.children.forEach(c => {
              var ct = tasksById[c.metadata.id];
              if (ct && !ct.parentId) {
                ct.parentId = v.task.id;
              }
            });
          }
          // and if this was submitted by something known set the submitter as the parent
          if (v.task.submittedByTask) {
            v.parentId = v.task.submittedByTask.metadata.id;
          }
        });
        Object.values(tasksById).forEach(v => {
          if (v.parentId) {
            var parentTask = tasksById[v.parentId];
            if (parentTask) {
              // we know the parent, put this as a child of it
              if (!parentTask.children) parentTask.children = [];
              parentTask.children.push(v);
              return;
            }
          }
          // put at root if we don't know the parent
          tasksData.children.push(v);
        })
    }
    
    
    // set <=0 to show any depth 
    var max_depth_to_show = 8;
    
    var d3_root, chart;
    
    var partition = d3.partition();
    
    var width;
    var radius;
    
    var sizing;
    // arc pointing down, kilt-like
    sizing = {
      visible_arc_length: 1/12,
      visible_arc_start_fn: x => (1 - 1/12)/2,
      inner_radius: 2/3,
      height_width_ratio: 0.71,
      width_radius_ratio: 0.5,
      width_translation: 0.5,
      height_translation: -1.7,
      scale: 3.83,
      font_size: "3.25px",
    };
    // not above, other nice sizing options and orientations are in git history
    
    var scaling;
    scaling = {
      fx: d3.scaleLinear().range([0, 2 * Math.PI]),
      
      fyA: function(depth) { return d3.scalePow().exponent(0.7).range([radius * sizing.inner_radius, radius])(depth); },
      fyB: function(depth) { return 1-Math.pow(0.9, depth); },
      fyM: 1,
      fy: function(depth) { return scaling.fyA( scaling.fyB(depth)/scaling.fyM ); },

      maxdepth: 1,      
      setMaxDepth: function(m) {
        if (!m || m<=1) m=1;
        scaling.maxdepth = m;
        scaling.fyM = scaling.fyB(m);
      },
      updateMaxDepthFor(root) {
        var md = 1;
        root.each(n => { if (n.depth > md) { md = n.depth; } });
        if (max_depth_to_show > 0 && md > max_depth_to_show) {
          md = max_depth_to_show;
        }
        scaling.setMaxDepth(md);
      }
    };
    
    function sizeOfTask(task) {
      if (!task) return null;
      if (!task.submitTimeUtc) {
        if (task.task) {
          return sizeOfTask(task.task);
        }
      }
      var duration;
      if (task.endTimeUtc) {
        // if completed, take the actual time (but minimum of 10 millis = width 1 after log)
        duration = task.endTimeUtc - task.startTimeUtc;
        if (duration<=100) duration = 10;
        
      } else if (task.startTimeUtc) {
        // if in progress, take the elapsed time with minimum of 3s = width 3.5 after log
        duration = 3000 + Math.max(0, Date.now() - task.startTimeUtc);
        
      } else {
        // if not started, use default of 100 millis = width 2 after log
        duration = 100;
      }
      if (task.isError) {
        // make sure error tasks are prominent
        duration += 3000;
      }
      
      return Math.log(duration) / Math.log(10);
    }
    
    function mouseleave(d) {
      // Transition each segment to full opacity and then reactivate it.
      d3_root.selectAll("path")
          .transition()
          .duration(300)
          .style("opacity", 1);

      d3_root.selectAll(".detail #detail1 .value").style("display", "none");
      d3_root.selectAll(".detail .real").style("display", "none");
      d3_root.selectAll(".detail .default").style("display", "");
      d3_root.select(".detail #detail2").style("display", "");
    }
    
    // show detail, Fade all but the current sequence, and show it in the breadcrumb trail
    function mouseover(d) {
      var t = d.data && d.data.task;
      if (t) {
        d3_root.select(".detail #detail1 .value").text(t.displayName || t.id);
        d3_root.select(".detail #detail2 .value").text(t.description);
        d3_root.select(".detail #detail2")
            .style("display", t.description ? "" : "none");
        var detail3 = "";
        if (t.endTimeUtc) {
            detail3 = 
              (t.isError ? "Error running task. " : "")+
              "Completed "+
              (moment(t.endTimeUtc).fromNow())+"; "+
              "took "+moment.duration(t.endTimeUtc - t.startTimeUtc).humanize()+". ";
        } else if (t.startTimeUtc) {
            detail3 = "In progress. Started "+(moment(t.startTimeUtc).fromNow())+".";
        } else {
            detail3 = "Not started.";
        }
        d3_root.select(".detail #detail3 .value").text(detail3);
        d3_root.selectAll(".detail .default").style("display", "none");
        d3_root.selectAll(".detail .real").style("display", "");
        d3_root.selectAll(".detail #detail1 .value").style("display", "");
      }
    
      var sequenceArray = d.ancestors().reverse();
      sequenceArray.shift(); // remove root node from the array
      
      chart.selectAll("path")
      // Fade all the segments.
          .transition()
          .duration(100)
          .style("opacity", 0.3);
    
      // But highlight those that are an ancestor of the current segment.
      chart.selectAll("path")
          .filter(function(node) {
                    return (sequenceArray.indexOf(node) >= 0);
                  })
          .transition()
          .duration(100)
          .style("opacity", 1);
    }
    
    function update(rawData) {
      if (rawData && rawData.children!=null && !rawData.children.length) {
        // just hide if there's no data
        d3_root.style("display", "none");
      } else {
        d3_root.style("display", "");
      }
      
      var root = d3.hierarchy(rawData);
      
      // set depth on the data so we can stop recursively sizing beyond a given depth
      root.each(n => { n.data.depth = n.depth; });          
      scaling.updateMaxDepthFor(root);
      
      root.sum(function(x) {
        if (x.depth && max_depth_to_show > 0 && x.depth > max_depth_to_show) {
          // disregard nodes that are out of scope (so that piece of pie doesn't get huge)
          return 0;
        }
        var kidsValue = 0;
        if (x.children) x.children.forEach((c) => { kidsValue += c.value; });
        return Math.max(0, sizeOfTask(x) - kidsValue);
      });
      
      root.sort(util.orderFn);
      var data = root;
        
      var dd = partition(root).descendants().filter(function(d) {
              return d.depth > 0 && (max_depth_to_show <= 0 || d.depth <= max_depth_to_show);
          });
      
      var g = chart.selectAll("g.node").data(dd, util.taskId);
      g.exit().remove();
      
      var g_enter = g.enter().append("g").attr("class", "node");
        
      var path_enter = g_enter.append("path")
          .attr("class", function(d) { return util.taskClasses(d, ["arc", "primary"]).join(" "); })
          .on("mouseover", mouseover)
          .on("click", click)
          .style("fill", function(d) { return util.colors.f(d); });
      path_enter
          .transition().duration(300)
          .attrTween("d", function (d) { return function(t) {
             return util.arcF({ scaling: scaling, visible_arc_length: sizing.visible_arc_length, 
                visible_arc_start_fn: sizing.visible_arc_start_fn, t: t })(d);
          }; });
      g.select("path.arc.primary")
        .attr("class", function(d) { return util.taskClasses(d, ["arc", "primary"]).join(" "); })
        .transition().duration(300)
        .attr("d", util.arcF({ scaling: scaling, visible_arc_length: sizing.visible_arc_length,
                visible_arc_start_fn: sizing.visible_arc_start_fn }))
        .style("fill", function(d) { return util.colors.f(d); });
     
      path_enter.append("animate")
        .attr("attributeType", "XML")
        .attr("attributeName", "fill");
      g.select("path.arc.primary animate")
        .attr("values", function(d) { return util.isInProgress(d) 
            ? util.colors.ACTIVE_ANIMATE_VALUES : util.colors.f(d); })
        .attr("dur", "1.5s")
        .attr("repeatCount", function(d) { return util.isInProgress(d) ? "indefinite" : 0; });

      g_enter.filter(util.isNewEntity).append("path").on("click", click)
        .attr("class", function(d) { return util.taskClasses(d, ["arc", "primary"]).join(" "); })
        .style("fill", function(d) { return util.colors.f(d); })
        .transition().duration(300)
          .attrTween("d", function (d) { return function(t) {
             return util.arcF({ scaling: scaling, visible_arc_length: sizing.visible_arc_length, 
                visible_arc_start_fn: sizing.visible_arc_start_fn, isMinimal: true, t: t })(d);
          }; });
      g.select("path.arc.entering-new-entity")
        .attr("class", function(d) { return util.taskClasses(d, ["arc", "entering-new-entity"]).join(" "); })
        .transition().duration(300)
        .attr("d", util.arcF({ scaling: scaling, visible_arc_length: sizing.visible_arc_length, 
            visible_arc_start_fn: sizing.visible_arc_start_fn, isMinimal: true}))
        .style("fill", function(d) { return util.colors.f(d); });
      
      g_enter.append("text")
          .attr("class", function(d) { return util.taskClasses(d, ["arc-label"]).join(" "); })
          .attr("font-size", sizing.font_size) // vertical-align
          .attr("dy", ".35em")
          .style("opacity", 0)
          .on("click", click)
          .transition().duration(600).style("opacity", function(t) {
            return t < 0.5 ? 0 : (t-0.5)*2;
          });
      // fade in text, slower than arcs so that they are in the right place when text becomes visible

      g.select("text.arc-label")
          .attr("class", function(d) { return util.taskClasses(d, ["arc-label"]).join(" "); })
          .text(function(d) {
              // only display if arc is big enough 
              if (d.x1 - d.x0 < 0.07) return "";
              var display = d.data.name || "";
              if (display.length>25) display = display.substr(0, 23)+"...";
              return display; })
          .attr("transform", function(d) { return "rotate(" + computeTextRotation(d) + ")"; })
          .attr("x", function(d) { return scaling.fy(d.depth-1); })
          .attr("dx", function(d) {
            // margin - slightly greater on inner arcs, and if it's a cross-entity
            return "" + ((d.depth > 3 ? 2 : 4 - d.depth/2) + (util.isNewEntity(d) ? 1.5 : 0));
          })
          .transition().duration(600).style("opacity", 1);
    }

    function computeTextRotation(d) {
      return ( (scaling.fx((d.x0 + d.x1)/2)) * sizing.visible_arc_length 
            + sizing.visible_arc_start_fn(sizing.visible_arc_length) * 2 * Math.PI 
            - Math.PI / 2)
        * 360 / (2 * Math.PI) ;
    }
    
    function click(d) {
      var t = util.findTask(d);
      $state.go("main.inspect.activities.detail", {entityId: t.entityId, activityId: t.id});
    }
                
    result.redraw = function() {
        // update chart size
        width = $element.find("svg")[0].getBoundingClientRect().width;
        var height = width * sizing.height_width_ratio;
        radius = width * sizing.width_radius_ratio;

        d3_root = d3.select($element[0]);
        chart = d3_root.select("#chart")
                    .attr("width", width).attr("height", height)
                    .select("g.root")
                        .attr("transform", "translate(" + width*sizing.width_translation + "," + height*sizing.height_translation + ") "+
                            "scale("+sizing.scale+")");
          
        update(tasksData); 
    };

    result.resize = result.redraw;
 
    result.prepData();
    result.redraw();
    chart.on("mouseleave", mouseleave);
        
    return result;      
}
