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
import jssha from 'jssha';
import brUtils from '../utils/general';
import 'angular-multiple-transclusion';
import template from './index.html';

const TEMPLATE_CONTAINER_URL = 'br/template/table/table.html';
const MODULE_NAME = 'brooklyn.components.table';

angular.module(MODULE_NAME, ['angular-multiple-transclusion', brUtils])
    .directive('brTable', ['$log', brTableDirective])
    .directive('bindHtmlCompile', ['$compile', brBindHtmlCompile])
    .filter('deepFilter', ['$filter', '$parse', brDeepFilter])
    .run(['$templateCache', brTableRun]);

export default MODULE_NAME;

/**
 * BASIC
 *
 * <br-table ng-model="data" columns="columns">
 * 
 * where for example `data = [ { name: "Babs", age: 20 }, { name: "Bob", age: 21 } ]`
 * and `columns = [ { field: 'name' }, { header: 'Age', template: '{{ item.age }} years old' } ]`
 *
 *
 * COMPLETE
 *
 * <br-table
 *   ng-model="..." column="..."     // required, as above
 *   row-ui-state="app" row-ui-state-params="getUiStateParams"   // ui-router state to redirect on row click, with function giving parameters
 *   col-width="100"    // minimum size in px to require for underlying <table> columns (unless overridden) 
 *   >
 *
 * Each column map entry may also include:
 *   field, // optional, if supplied it provides a default for header, template, orderBy, and id
 *   header, // required, unless field is specified in which case it provides a default value (with "camelCaseEXAMPLE" rendered as "Camel Case EXAMPLE")
 *   template, templateUrl,  // exactly one of these is required, unless field is specified in which case `{{ item[field] }}` is a default value
 *   orderBy: 'name', // a field on the object to use for sorting; if omitted, and field is not set, the column is not sortable
 *   id: 'name', // a unique ID for the column, used for column-specific searching, and set as a class for styling;
 *                  this ID is used in regexes so should not contain spaces or regex special characters (`.` or `(`);
 *                  if omitted, `field` is used if specified, otherwise a `col-N` identifier is used (and column-specific searches are not offered as suggestions)
 *   tdClass: 'fancy-column', // a string to set as a class on the <td> items in this column; if omitted and `id` is explicit, that is used as a default; failing that no column-specific classes are set
 *   colspan: 3, // number of <table> columns to use for this logical column - useful to control relative widths as the <table> columns are all the same width
 *   width: 100, // width of the column in px; if used with colspan this applies to _one_ column and the colspan-1 others are an additional relative width
 *   hidden: false, // whether column is initially hidden
 *
 *
 * WIDTHS
 *
 * The combo of colspan and width allows fine control over column widths, e.g.:
 *
 * [ { header: "A", width: 200, colspan: 2 }, { header: "B", colspan: 3 } ]
 * will set up a table with 5 <table> columns, with A spanning 2 and B spanning 3.
 * One of A's columns is fixed at 200px; the other 4 columns share equally the remaining width.
 * So the table's minimum width is 200px, and at that size B will not be visible.
 * At 300px, there is 100px "remaining" split among the four regular columns, so
 * A gets 225px (a 200px column plus one regular column) and B gets 75x (three regular columns).
 * At 600px, the two logical columns - A and B - are equally sized at 300px.
 * Beyond this, column B is wider. 
 *
 * If additionally `col-width="100"` is set on the `br-table`, then the table will start
 * with minimum width 600px (possibly requiring horizontal scrolling to see in a small browser).
 * Individual columns can be resized by a user subsequently.    
 * 
 * For convenience (and compatibility for tables before colspan support was added)
 * if no column entries define a colspan, the table layout is auto,
 * with any explicit `width` being respected and other columns based on content width.
 *
 *
 * SEARCH
 *
 * When searching, phrases in double quotes "like this" search for that group of words with no spaces 
 * using angular case-insensitive containment (non-regex).
 * Any remaining term of the form `key:value` where `key` is one of the column's `id`
 * will do a regex search for that value in the respective column.
 * All other terms are searched for as individual words using angular case-insensitive containment (non-regex).
 * The angular (non-regex) search treats a leading `!` as negation, to search for entries _not_ containing the term.
 */
export function brTableDirective($log) {
    return {
        require: 'ngModel',
        transclude: true,
        restrict: 'E',
        link: link,
        controller: ['$templateCache', 'brUtilsGeneral', controller],
        controllerAs: 'ctrl',
        templateUrl: function(element, attrs) {
            return attrs.templateUrl || TEMPLATE_CONTAINER_URL;
        }
    };

    function link(scope, element, attrs, ngModelCtrl) {
        scope.ctrl.rowUiState = attrs.rowUiState;
        scope.ctrl.rowUiStateParams = scope.$eval(attrs.rowUiStateParams);
        scope.ctrl.state = {
            columns: scope.$eval(attrs.columns),
            sorts: [],
            search: '',
            filters: {}
        };

        if (!(scope.ctrl.state.columns instanceof Array)) {
            throw new Error('Field "columns" in table options must be of type "Array"');
        }
        scope.ctrl.state.columnSpanCount = 0;
        scope.ctrl.state.columnExplicitWidthCount = 0;
        scope.ctrl.state.columnExplicitWidthSum = 0;
        scope.ctrl.tableLayoutFixed = false;
        scope.ctrl.state.columns.forEach((column, index) => {
            if (!(column instanceof Object)) {
                throw new Error(`Column with index "${index}" must be of type "Object"`);
            }
            let field = column.field;
            if (!column.hasOwnProperty('header')) {
                if (field) {
                    column.header = field.replace(/([a-z])([A-Z])/g, (_, a, A) => a+' '+A).replace(/^([a-z])(.*)/, (_, a, bc) => a.toUpperCase()+bc)
                } else {
                    throw new Error(`Column with index ${index} does not has the required field "header"`);
                }
            }
            if (!column.hasOwnProperty('template') && !column.hasOwnProperty('templateUrl')) {
                if (field) {
                    column.template = `{{ item['${field}'] }}`;
                } else {
                    throw new Error(`Column with index ${index} requires either "template" or "templateUrl" field`);
                }
            }
            if (!column.hasOwnProperty('id')) {
                if (field) {
                    column.id = field;
                } else {
                    column.id = 'col-'+index;
                    column.idAutogenerated = true;
                }
            } else {
                column.tdClass = column.tdClass || column.id;
            }
            if (!column.hasOwnProperty('orderBy') && field) {
                column.orderBy = field;
            }

            column.hidden = column.hidden || false;

            column.regex = new RegExp(`(?:\\s|^)${column.id}:(\\S*)(?:\\s|$)`, 'i')
            
            if (!column.idAutogenerated) {
              column.idForTypeahead = column.id;
            }
        });
        
        function recomputeSpanCount() {
            // this should be recomputed when columns are hidden/shown
            // without this, the "No results" message may be slightly too wide when columns are hidden
            
            var columnSpanCount = 0,
                columnExplicitWidthCount = 0,
                columnExplicitWidthSum = 0,
                tableLayoutFixed = false;
            
            scope.ctrl.state.columns.forEach((column, index) => {
                if (column.hidden) return;
                columnSpanCount += (column.colspan || 1);
                tableLayoutFixed |= column.colspan;
                if (column.width) {
                    columnExplicitWidthCount ++;
                    columnExplicitWidthSum += column.width;
                }
            });
            
            scope.ctrl.state.columnSpanCount = columnSpanCount;
            scope.ctrl.state.columnExplicitWidthCount = columnExplicitWidthCount;
            scope.ctrl.state.columnExplicitWidthSum = columnExplicitWidthSum;
            scope.ctrl.tableLayoutFixed = tableLayoutFixed;
            
            if (attrs.colWidth) {
                var minWidth = (scope.ctrl.state.columnExplicitWidthSum + 
                    (scope.ctrl.state.columnSpanCount - scope.ctrl.state.columnExplicitWidthCount) * attrs.colWidth);
                if (isNaN(parseFloat(minWidth)) || !isFinite(minWidth)) {
                    // not a valid number in the end: could install units-css library and do unit maths, but not worth it
                    $log.error(`Error computing column widths (got ${scope.ctrl.minWidth}): ensure no values have units`);
                } else {
                    scope.ctrl.minWidth = minWidth + 'px';
                }
            }
        }
        
        recomputeSpanCount();
        
        scope.hideColumn = (column,) => {
            column.hidden = !column.hidden;
            recomputeSpanCount();
        };

        let sha = new jssha('SHA-512', 'TEXT');
        sha.update(scope.ctrl.rowUiState || '');
        sha.update(JSON.stringify(scope.ctrl.rowUiStateParams) || '');
        sha.update(JSON.stringify(scope.ctrl.state.columns) || '');
        let hash = sha.getHash('HEX');

        if (sessionStorage) {
            let state = sessionStorage.getItem(`${MODULE_NAME}.state.${hash}`);
            if (state !== null) {
                scope.ctrl.state = Object.assign(scope.ctrl.state, JSON.parse(state));
                scope.ctrl.state.columns.forEach(column => column.regex = new RegExp(`(?:\\s|^)${column.id}:(\\S*)(?:\\s|$)`, 'i'));
            }

            scope.$watch('ctrl.state', (newValue, oldValue) => {
                if (!angular.equals(newValue, oldValue)) {
                    sessionStorage.setItem(`${MODULE_NAME}.state.${hash}`, JSON.stringify(newValue));
                }
            }, true);
        }

        scope.$watchCollection('ctrl.items', function(value) {
            ngModelCtrl.$setViewValue(value);
            ngModelCtrl.$validate();
        });

        ngModelCtrl.$render = function() {
            if (!ngModelCtrl.$viewValue) {
                ngModelCtrl.$viewValue = [];
            }
            scope.ctrl.items = ngModelCtrl.$viewValue;
        };

        scope.$applyAsync(() => {
            element[0].querySelectorAll('th div').forEach(elm => {
                angular.element(elm).data('initialWidth', elm.offsetWidth);
            });
            element[0].querySelectorAll('span.column-resizer').forEach(elm => {
                elm.ondragstart = function() { return false; };
                elm.addEventListener('mousedown', function(e) {
                    if (e.which === 1) {
                        // left mouse click
                        scope.ctrl.dragStart(e);
                    }
                }, false);
            });
        });

        scope.$watch('ctrl.state.search', (newValue, oldValue) => {
            if (newValue === oldValue) {
                return;
            }
            let filters = {};
            let remaining = newValue;
            let words = [];
            // get any phrases in double quotes
            let qw = /(?:\s|^)"([^"]*)"(?:\s|$)/;
            var match;
            while (match=qw.exec(remaining)) {
                words.push(match[1]);
                remaining = remaining.replace(qw, ' ');
            }
            // now get anything that matches column prefix
            scope.ctrl.state.columns.forEach(column => {
                if (column.hidden) {
                    return;
                }
                let matches = remaining.match(column.regex);
                if (matches === null) {
                    return;
                }
                filters[column.id] = matches[1];
                remaining = remaining.replace(column.regex, ' ');
            });
            // remaining items are split
            remaining = remaining.trim();
            if (remaining.length > 0) {
                words = words.concat(remaining.split(/\s+/));
            }
            words = words.length==0 ? null : words.length==1 ? words[0] : words;
            if (Object.keys(filters).length > 0) {
                if (words) {
                    filters[''] = words;
                }
            }
            scope.ctrl.state.filters = Object.keys(filters).length > 0 ? filters : words;
        });
    }

    function findAncestor($el, tag) {
        while ($el[0] && $el[0].tagName.toUpperCase() != tag.toUpperCase()) { 
                $el = $el.parent(); 
        };
        return $el;
    }

    function controller($templateCache, brUtilsGeneral) {
        this.getColumnTemplate = (id) => {
            let column = this.state.columns.find(column => column.id === id);
            return column.hasOwnProperty('templateUrl') ? $templateCache.get(column.templateUrl) : column.template;
        };

        this.dragStart = (e) => {
            this.resizerTarget = angular.element(e.target);
            this.thTarget = findAncestor(this.resizerTarget, 'th');
            this.tableTarget = findAncestor(this.thTarget, 'table');
            if (!this.tableTarget[0]) throw new Error('Resizer tag hierarchy not as expected; cannot drag');
            
            this.tableWidth = this.tableTarget[0].offsetWidth;
            if (this.tableTarget[0].style.minWidth != 0) {
                // if a width is defined, we need to hardcode all column widths
                // this.tableTarget.find('colgroup').children().forEach(
                angular.forEach( this.tableTarget.find('thead').find("tr").children(), th => { th.width = th.offsetWidth; } );
                angular.forEach( this.tableTarget.find('colgroup').children(), col => { col.style.width = null; } );
                this.tableTarget[0].style.minWidth = 0;
            }
            this.width = this.thTarget[0].offsetWidth;
            this.start = e.clientX;

            document.addEventListener('mouseup', this.dragEnd, false);
            document.addEventListener('mousemove', this.dragging, false);

            this.resizerTarget.addClass('dragging');
            
            // Disable highlighting while dragging
            if (e.stopPropagation) e.stopPropagation();
            if (e.preventDefault) e.preventDefault();
        };
        this.dragging = (e) => {
            // 23px wide is bare minimum given padding settings
            // if user goes below this we could give some visual indication the column is being hidden 
            var newWidth = Math.max(this.width - this.start + e.clientX, 23);  
            this.thTarget[0].style['width'] = `${newWidth}px`;
            this.tableTarget[0].style['width'] = `${this.tableWidth + newWidth - this.width}px`;
        };
        this.dragEnd = (e) => {
            document.removeEventListener('mouseup', this.dragEnd, false);
            document.removeEventListener('mousemove', this.dragging, false);
            this.resizerTarget.removeClass('dragging');
        };

        this.sortBy = (orderBy) => {
            let sort = '+';
            let currentOrderBy = this.getSortByFrom(orderBy);
            let currentOrderByIndex = this.state.sorts.indexOf(currentOrderBy);

            if (currentOrderBy) {
                let currentSort = this.getSortByDirectionFrom(orderBy);
                if (currentSort === '-') {
                    this.state.sorts.splice(currentOrderByIndex, 1);
                    return;
                }
                if (currentSort === '+') {
                    sort = '-';
                }
                this.state.sorts.splice(currentOrderByIndex, 1, `${sort}${orderBy}`);
            } else {
                this.state.sorts.push(`${sort}${orderBy}`);
            }
        };

        this.getSortByFrom = (orderBy) => {
            return this.state.sorts.find(sort => sort.substr(1) === orderBy);
        };

        this.getSortByDirectionFrom = (orderBy) => {
            let sortBy = this.getSortByFrom(orderBy);
            return sortBy ? sortBy.slice(0, 1) : '';
        };

        this.suggestionFormatter = (input) => {
            return brUtilsGeneral.isNonEmpty(input) ? `${input}:` : '';
        };
    }
}

export function brBindHtmlCompile($compile) {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            scope.$watch(function () {
                return scope.$eval(attrs.bindHtmlCompile);
            }, function (value) {
                element.html(value);
                $compile(element.contents())(scope);
            });
        }
    };
}

export function brDeepFilter($filter, $parse) {
    return function(input, opts) {
        if (angular.isString(opts)) {
            return $filter('filter')(input, opts);
        }
        if (angular.isArray(opts)) {
            opts = { '': opts };
        }
        if (angular.isObject(opts) && Object.keys(opts).length > 0) {
            return input.filter(item => {
                return Object.keys(opts).reduce((ret, key) => {
                    if (!ret) return false;
                    if (key == '') {
                        // empty key used for text search
                        let searchList = opts[key];
                        if (!angular.isArray(searchList)) searchList = [ searchList ];
                        return searchList.every( word => $filter('filter')([ item ], word).length );
                    }
                    let value = $parse(key)(item);
                    if (!value) return false;
                    let vv = JSON.stringify(value);
                    if (vv[0]=='"') vv = vv.slice(1, vv.length - 1);
                    return new RegExp(opts[key], 'ig').test(vv);
                }, true);
            });
        }
        return input;
    };
}

export function brTableRun($templateCache) {
    $templateCache.put(TEMPLATE_CONTAINER_URL, template);
}

