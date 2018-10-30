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
import {EntityFamily} from '../util/model/entity.model';
import template from './catalog-selector.template.html';
import footerTemplate from './catalog-selector-palette-footer.html';
import { distanceInWordsToNow } from 'date-fns';

const MIN_ROWS_PER_PAGE = 4;

const PALETTE_VIEW_ORDERS = {
        name: { label: "Name", field: "displayName" },
        lastUsed: { label: "Recent", field: "-lastUsed" }, 
        bundle: { label: "Bundle", field: "containingBundle" }, 
        id: { label: "ID", field: "symbolicName" }, 
    };

const PALETTE_VIEW_MODES = {
        compact: { name: "Compact", classes: "col-xs-2 item-compact", itemsPerRow: 6, rowHeightPx: 75, hideName: true },
        normal: { name: "Normal", classes: "col-xs-3", itemsPerRow: 4 },
        large: { name: "Large", classes: "col-xs-4", itemsPerRow: 3 },
        list: { name: "List", classes: "col-xs-12 item-full-width", itemsPerRow: 1 },
    };

// fields in either bundle or type record:
const FIELDS_TO_SEARCH = ['name', 'displayName', 'symbolicName', 'version', 'type', 'supertypes', 'containingBundle', 'description', 'displayTags', 'tags'];

export function catalogSelectorDirective() {
    return {
        restrict: 'E',
        scope: {
            family: '<',
            onSelect: '&',
            rowsPerPage: '<?',  // if unset then fill
            reservedKeys: '<?',
            state: '<?',
            mode: '@?',  // for use by downstream projects to pass in special modes
        },
        template: template,
        controller: ['$scope', '$element', '$timeout', '$q', '$uibModal', '$log', '$templateCache', 'paletteApi', 'paletteDragAndDropService', 'iconGenerator', 'composerOverrides', 'recentlyUsedService', controller],
        link: link,
    };
}

function link($scope, $element, attrs, controller) {
    let main = angular.element($element[0].querySelector(".catalog-palette-main"));

    // repaginate when load completes (and items are shown), or it is resized
    $scope.$watchGroup(
        [ () => $scope.isLoading, () => main[0].offsetHeight, () => $scope.state.viewMode.itemsPerRow ],
        (values) => controller.$timeout( () => repaginate($scope, $element) ) );
    // also repaginate on window resize    
    angular.element(window).bind('resize', () => repaginate($scope, $element));
}

function repaginate($scope, $element) {
    let rowsPerPage = $scope.rowsPerPage;
    if (!rowsPerPage) {
        let main = angular.element($element[0].querySelector(".catalog-palette-main"));
        if (!main || main[0].offsetHeight==0) {
            // no main, or hidden, or items per page fixed
            return;
        }
        let header = angular.element(main[0].querySelector(".catalog-palette-header"));
        let footer = angular.element(main[0].querySelector(".catalog-palette-footer"));
        rowsPerPage = Math.max(MIN_ROWS_PER_PAGE, Math.floor( (main[0].offsetHeight - header[0].offsetHeight - footer[0].offsetHeight - 16) / ($scope.state.viewMode.rowHeightPx || 96)) );
    }
    $scope.$apply( () => $scope.pagination.itemsPerPage = rowsPerPage * $scope.state.viewMode.itemsPerRow );
}

export function catalogSelectorSearchFilter() {
    return function (items, search) {
        if (search) {
            return items.filter(function (item) {
                return search.toLowerCase().split(' ').reduce( (found, part) => 
                    found &&
                    FIELDS_TO_SEARCH
                        .filter(field => item.hasOwnProperty(field) && item[field])
                        .reduce((match, field) => {
                            if (match) return true;
                            let text = item[field];
                            if (!text.toLowerCase) {
                                text = JSON.stringify(text).toLowerCase();
                            } else {
                                text = text.toLowerCase();
                            }
                            return match || text.indexOf(part) > -1;
                        }, false)
                , true);
            });
        } else {
            return items;
        }
    }
}

export function catalogSelectorFiltersFilter() {
    // compute counts and apply active filters;     
    // this is called by the view after filtering based on search,
    // so filters can adjust based on number of search results
    return function (items, $scope) {
      $scope.itemsBeforeActiveFilters = items;
      $scope.skippingFilters = false; 
      let filters = $scope.filters.filter(f => f.enabled);
      let filtersWithFn = filters.filter(f => f.filterFn);
      if (!filters.length) {
        $scope.itemsAfterActiveFilters = items;
        return items;
      }
      filters.forEach(filter => { if (filter.filterInit) items = filter.filterInit(items); });
      if (filtersWithFn.length) {
        items = items.filter( item => filtersWithFn.some(filter => filter.filterFn(item)) );
      }
      if (!items || !items.length) {
        // if search matches nothing then disable filters
        items = $scope.itemsAfterActiveFilters = $scope.itemsBeforeActiveFilters;
        $scope.skippingFilters = true;
      } else {
        if (filters.find(filter => filter.limitToOnePage)) {
            items = items.splice(0, $scope.pagination.itemsPerPage);
        }  
        $scope.itemsAfterActiveFilters = items;
      }
      return items; 

    }
}

function controller($scope, $element, $timeout, $q, $uibModal, $log, $templateCache, paletteApi, paletteDragAndDropService, iconGenerator, composerOverrides, recentlyUsedService) {
    this.$timeout = $timeout;

    $scope.viewModes = PALETTE_VIEW_MODES;
    $scope.viewOrders = PALETTE_VIEW_ORDERS;
    
    if (!$scope.state) $scope.state = {};
    if (!$scope.state.viewMode) $scope.state.viewMode = PALETTE_VIEW_MODES.normal;
    if (!$scope.state.currentOrder) $scope.state.currentOrder = [ PALETTE_VIEW_ORDERS.name.field, '-version' ];
    
    $scope.pagination = {
        page: 1,
        itemsPerPage: $scope.state.viewMode.itemsPerRow * ($scope.rowsPerPage || 1)  // will fill out after load
    };
    
    $scope.getEntityNameForPalette = function(item, entityName) {
        return (composerOverrides.getEntityNameForPalette || 
            // above can be overridden with function of signature below to customize display name in palette
            function(item, entityName, scope) { return entityName; }
        )(item, entityName, $scope);
    }

    $scope.getPlaceHolder = function () {
        return 'Search';
    };
    
    $scope.isLoading = true;

    $scope.$watch('search', () => {
        $scope.freeFormTile = {
            symbolicName: $scope.search,
            name: $scope.search,
            displayName: $scope.search,
            supertypes: ($scope.family ? [ $scope.family.superType ] : []),
        };
    });

    $scope.getItems = function (search) {
        let defer = $q.resolve([]);

        switch ($scope.family) {
            case EntityFamily.ENTITY:
            case EntityFamily.SPEC:
                defer = paletteApi.getTypes({params: {supertype: 'entity', fragment: search}});
                break;
            case EntityFamily.POLICY:
                defer = paletteApi.getTypes({params: {supertype: 'policy', fragment: search}});
                break;
            case EntityFamily.ENRICHER:
                defer = paletteApi.getTypes({params: {supertype: 'enricher', fragment: search}});
                break;
            case EntityFamily.LOCATION:
                defer = paletteApi.getLocations();
                break;
        }

        return defer.then(data => {
            data = $scope.filterPaletteItemsForMode(data, $scope);
            data.forEach( recentlyUsedService.embellish );
            return data;
            
        }).catch(error => {
            return [];
        }).finally(() => {
            $scope.isLoading = false;
        });
    };
    function tryMarkUsed(item) {
        try {
            recentlyUsedService.markUsed(item);
        } catch (e) {
            // session storage can get full; usually the culprit is icons not this,
            // but we may wish to clear out old items to ensure we don't bleed here
            $log.warn("Could not mark item as used: "+item, e);
        }
    }
    $scope.onSelectItem = function (item) {
        if (angular.isFunction($scope.onSelect)) {
            tryMarkUsed(item);
            $scope.onSelect({item: item});
        }
        $scope.search = '';
    };
    $scope.onDragItem = function (item, event) {
        let frame = document.createElement('div');
        frame.classList.add('drag-frame');
        event.target.appendChild(frame);
        setTimeout(function() {
            // can remove at end of this cycle, browser will have grabbed its drag image
            frame.parentNode.removeChild(frame);
        }, 0);
        /* have tried many other ways to get a nice drag image;
           this seems to work best, adding an empty div which forces the size to be larger,
           so when grabbing the image it grabs the drop-shadow.
           things that _didn't_ work include:
           - styling event.target now then unstyling (normally this would work, in posts on the web, but it doesn't here; angular?)
           - make a restyled cloned copy offscreen (this comes so close but remote img srcs aren't loaded
         */
        
        paletteDragAndDropService.dragStart(item);
    };
    $scope.onDragEnd = function (item, event) {
        paletteDragAndDropService.dragEnd();
        tryMarkUsed(item);
    };
    $scope.sortBy = function (order) {
        let newOrder = [].concat($scope.state.currentOrder);
        newOrder = newOrder.filter( (o) => o !== order.field );
        $scope.state.currentOrder = [order.field].concat(newOrder);
    };
    $scope.allowFreeForm = function () {
        return [
            EntityFamily.LOCATION
        ].indexOf($scope.family) > -1;
    };
    $scope.isReserved = function () {
        if (!$scope.reservedKeys || !angular.isArray($scope.reservedKeys)) {
            return false;
        }
        return $scope.reservedKeys.indexOf($scope.search) > -1;
    };
    $scope.onImageError = (scope, el, attrs) => {
        $log.warn("Icon for "+attrs.itemId+" at "+angular.element(el).attr("src")+" could not be loaded; generating icon");
        angular.element(el).attr("src", iconGenerator(attrs.itemId));
    };

    // Init
    $scope.items = [];
    function getDisplayTags(tags) {
        if (!tags || !tags.length || !tags.reduce) return tags;
        return tags.reduce((result, tag) => { 
            if (!(/[=:\[\]()]/.exec(tag))) {
                result.push(tag);
            }
            return result; 
        }, []);
    }
    $scope.getItems().then((items)=> {
        // add displayTags, as any tag that doesn't contain = : or ( ) [ ]
        // any tag that is an object will be eliminated as it is toStringed to make [ object object ]
        items.forEach(item => { 
            if (item.tags) {
                item.displayTags = getDisplayTags(item.tags); 
            } 
        });
        $scope.items = items;
    });
    $scope.lastUsedText = (item) => {
        let l = (Number)(item.lastUsed);
        if (!l || isNaN(l) || l<=0) return "";
        if (l < 100000) return 'Preselected for inclusion in "Recent" filter.';
        return 'Last used: ' + distanceInWordsToNow(l, { includeSeconds: true, addSuffix: true });
    }; 
    $scope.showPaletteControls = false;
    $scope.onFiltersShown = () => {
      $timeout( () => {
        // check do we need to show the multiline
        let filters = angular.element($element[0].querySelector(".filters"));
        $scope.$apply( () => $scope.filterSettings.filtersMultilineAvailable = filters[0].scrollHeight > filters[0].offsetHeight + 6 );
        
        repaginate($scope, $element);
      } );
    };
    $scope.togglePaletteControls = () => {
        $scope.showPaletteControls = !$scope.showPaletteControls;
        $timeout( () => repaginate($scope, $element) );
    }
    $scope.toggleShowAllFilters = () => {
        $scope.filterSettings.showAllFilters = !$scope.filterSettings.showAllFilters;
        $timeout( () => repaginate($scope, $element) );
    };
    $scope.filterSettings = {};

    $scope.filters = [
        { label: 'Recent', icon: 'clock-o', title: "Recently used and standard favorites", limitToOnePage: true,
            filterInit: items => {
                $scope.recentItems = items.filter( i => i.lastUsed && i.lastUsed>0 );
                $scope.recentItems.sort( (a,b) => b.lastUsed - a.lastUsed );
                return $scope.recentItems; 
            }, enabled: false },
    ];
    $scope.disableFilters = (showFilters) => {
        $scope.filters.forEach( f => f.enabled = false );
        if (showFilters !== false) {
            $scope.showPaletteControls = true;
        }
    }
    
    // this can be overridden for palette sections/modes which show a subset of the types returned by the server;
    // this is applied when the data is received from the server.
    // it is used by catalogSelectorFiltersFilter; 
    $scope.filterPaletteItemsForMode = (items) => items;

    // downstream can override this to insert lines below the header
    $scope.customSubHeadTemplateName = 'composer-palette-empty-sub-head';
    $templateCache.put($scope.customSubHeadTemplateName, '');
    
    $scope.customFooterTemplateName = 'composer-palette-default-footer';
    $templateCache.put($scope.customFooterTemplateName, footerTemplate);

    // allow downstream to configure this controller and/or scope
    (composerOverrides.configurePaletteController || function() {})(this, $scope, $element);
}
