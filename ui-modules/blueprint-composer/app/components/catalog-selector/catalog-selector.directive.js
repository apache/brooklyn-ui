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

const ITEMS_PER_PAGE = 30;
// fields in either bundle or type record:
const FIELDS_TO_SEARCH = ['name', 'displayName', 'symbolicName', 'version', 'type', 'supertypes', 'containingBundle', 'description', 'displayTags'];

export function catalogSelectorDirective() {
    return {
        restrict: 'E',
        scope: {
            family: '<',
            onSelect: '&',
            itemsPerPage: '<',
            reservedKeys: '<?',
            mode: '@?',  // for use by downstream projects to pass in special modes
        },
        template: template,
        controller: ['$scope', '$element', '$q', '$uibModal', '$log', '$templateCache', 'paletteApi', 'paletteDragAndDropService', 'iconGenerator', 'composerOverrides', controller]
    };
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

export function catalogSelectorSortFilter($filter) {
    return function (items, family) {
        return items.sort(function (left, right) {
            let nameLeft;
            let nameRight;
            if (family) {
                switch (family) {
                    case EntityFamily.ENTITY:
                    case EntityFamily.SPEC:
                    case EntityFamily.POLICY:
                    case EntityFamily.ENRICHER:
                    case EntityFamily.LOCATION:
                        nameLeft = $filter('entityName')(left);
                        nameRight = $filter('entityName')(right);
                        break;
                }
            }

            if (!nameLeft || !nameRight) {
                return 0;
            }
            let nameCompare = nameLeft.localeCompare(nameRight);
            if (nameCompare !== 0) {
                return nameCompare;
            }
            let versionCompare = right.version.localeCompare(left.version);
            if (versionCompare !== 0) {
                return versionCompare
            }
            // TODO should symbolic name be the sorted field?
            let symNameCompare = left.symbolicName.localeCompare(right.symbolicName);
            if (symNameCompare !== 0) {
                return symNameCompare
            }            
            let containingBundleCompare = right.containingBundle.localeCompare(left.containingBundle);
            if (containingBundleCompare !== 0) {
                return containingBundleCompare
            }            
            return 0;
        });
    }
}

function controller($scope, $element, $q, $uibModal, $log, $templateCache, paletteApi, paletteDragAndDropService, iconGenerator, composerOverrides) {
    $scope.pagination = {
        page: 1,
        itemsPerPage: $scope.itemsPerPage || ITEMS_PER_PAGE
    };
    $scope.state = {
        orders: ['name', 'type', 'id'],
        currentOrder: 'name'
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
            supertypes: [$scope.family.superType]
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
            return data;
        }).catch(error => {
            return [];
        }).finally(() => {
            $scope.isLoading = false;
        });
    };
    $scope.onSelectItem = function (item) {
        if (angular.isFunction($scope.onSelect)) {
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
    // this can be overridden for third-party filters.
    // it receives result of filtering based on search so filters can adjust based on number of search resullts
    $scope.filterPaletteItems = (items) => items;

    // downstream can override this to insert lines below the header
    $scope.customSubHeadTemplateName = 'composer-palette-empty-sub-head';
    $templateCache.put($scope.customSubHeadTemplateName, '');
    
    $scope.customFooterTemplateName = 'composer-palette-empty-footer';
    $templateCache.put($scope.customFooterTemplateName, '');

    // allow downstream to configure this controller and/or scope
    (composerOverrides.configurePaletteController || function() {})(this, $scope, $element);
}
