import {drop} from "lodash/array";

const MODULE_NAME = 'ui.bootstrap.dropdown.nested';

export default MODULE_NAME;

angular.module(MODULE_NAME, ['ui.bootstrap.multiMap', 'ui.bootstrap.position'])

    .constant('uibDropdownConfigNested', {
        appendToOpenClass: 'uib-dropdown-open',
        openClass: 'open'
    })

    .service('uibDropdownServiceNested', ['$document', '$rootScope', '$$multiMap', function($document, $rootScope, $$multiMap) {
        var openScope = null;
        var oldOpenScopes = [];
        var openedContainers = $$multiMap.createNew();

        this.isOnlyOpen = function(dropdownScope, appendTo) {
            var openedDropdowns = openedContainers.get(appendTo);
            if (openedDropdowns) {
                var openDropdown = openedDropdowns.reduce(function(toClose, dropdown) {
                    if (dropdown.scope === dropdownScope) {
                        return dropdown;
                    }

                    return toClose;
                }, {});
                if (openDropdown) {
                    return openedDropdowns.length === 1;
                }
            }

            return false;
        };

        this.open = function(dropdownScope, element, appendTo) {
            if (!openScope) {
                $document.on('click', closeDropdown);
            }

            if (openScope && openScope !== dropdownScope) {
                // just remember it
                oldOpenScopes.push(openScope);
            }

            openScope = dropdownScope;

            if (!appendTo) {
                return;
            }

            var openedDropdowns = openedContainers.get(appendTo);
            if (openedDropdowns) {
                var openedScopes = openedDropdowns.map(function(dropdown) {
                    return dropdown.scope;
                });
                if (openedScopes.indexOf(dropdownScope) === -1) {
                    openedContainers.put(appendTo, {
                        scope: dropdownScope
                    });
                }
            } else {
                openedContainers.put(appendTo, {
                    scope: dropdownScope
                });
            }
        };

        function containsNested(container, target) {
            if (!container || !target || !container[0] || !target[0]) return false;
            if (container[0]==target[0]) return true;
            return containsNested(container, angular.element(target.parent()));
        }

        this.close = function(dropdownScope, element, appendTo) {
            if (openScope === dropdownScope) {
                openScope = null;
            }
            const indexOfOpen = oldOpenScopes.indexOf(dropdownScope);
            if (indexOfOpen>=0) {
                oldOpenScopes.splice(indexOfOpen, 1);
            }
            if (openScope==null && oldOpenScopes.length) {
                $document.off('click', closeDropdown);
                $document.off('keydown', this.keybindFilter);
            }
            [openScope, oldOpenScopes].filter(candidateChild => candidateChild && candidateChild.getToggleElement && containsNested(dropdownScope.getDropdownElement(), candidateChild.getToggleElement()))
                .forEach(containedChild => containedChild.isOpen = false);

            if (!appendTo) {
                return;
            }

            var openedDropdowns = openedContainers.get(appendTo);
            if (openedDropdowns) {
                var dropdownToClose = openedDropdowns.reduce(function(toClose, dropdown) {
                    if (dropdown.scope === dropdownScope) {
                        return dropdown;
                    }

                    return toClose;
                }, {});
                if (dropdownToClose) {
                    openedContainers.remove(appendTo, dropdownToClose);
                }
            }
        };

        var closeDropdown = function(evt) {
            // This method may still be called during the same mouse event that
            // unbound this event handler. So check openScope before proceeding.
            let scopesToApply = [];

            function isAnyTrigger($element) {
                return $element.hasClass('dropdown-toggle');
            }

            function isAnyAncestor($element, test) {
                if (!$element || !$element[0]) return false;
                if (test($element)) {
                    return true;
                }
                return isAnyAncestor(angular.element($element.parent()), test);
            }

            function closeIfApplicable(scope) {
                if (evt) {
                    if (scope.getAutoClose() === 'disabled') {
                        return;
                    }

                    if (evt.which === 3) {
                        return;
                    }

                    if (isAnyAncestor(angular.element(evt.target), isAnyTrigger)) {
                        return;
                    }

                    var toggleElement = scope.getToggleElement();
                    if (toggleElement && containsNested(angular.element(toggleElement), angular.element(evt.target))) {
                        return;
                    }

                    if (scope.getAutoClose() === 'outsideClick' &&
                        containsNested(angular.element(scope.getDropdownElement()), angular.element(evt.target))) {
                        return;
                    }
                }

                scope.isOpen = false;
                scopesToApply.push(scope);

                return true;
            }

            if (openScope && openScope.isOpen) {
                if (closeIfApplicable(openScope)) {
                    openScope.focusToggleElement();
                }
            }

            // close all the others too
            const scopesToKeep = [];
            oldOpenScopes.forEach(scope => {
                if (!closeIfApplicable(scope)) {
                    scopesToKeep.push(scope);
                }
            });
            oldOpenScopes.splice(0, oldOpenScopes.length, ...scopesToKeep);

            // and apply
            if (!$rootScope.$$phase) {
                scopesToApply.forEach(s => s.$apply());
            }
        };

        this.keybindFilter = function(evt) {
            if (!openScope) {
                // see this.close as ESC could have been pressed which kills the scope so we can not proceed
                return;
            }

            var dropdownElement = openScope.getDropdownElement();
            var toggleElement = openScope.getToggleElement();
            var dropdownElementTargeted = dropdownElement && dropdownElement[0].contains(evt.target);
            var toggleElementTargeted = toggleElement && toggleElement[0].contains(evt.target);
            if (evt.which === 27) {
                evt.stopPropagation();
                openScope.focusToggleElement();
                closeDropdown();
            } else if (openScope.isKeynavEnabled() && [38, 40].indexOf(evt.which) !== -1 && openScope.isOpen && (dropdownElementTargeted || toggleElementTargeted)) {
                evt.preventDefault();
                evt.stopPropagation();
                openScope.focusDropdownEntry(evt.which);
            }
        };
    }])

    .controller('UibDropdownControllerNested', ['$scope', '$element', '$attrs', '$parse', 'uibDropdownConfigNested', 'uibDropdownServiceNested', '$animate', '$uibPosition', '$document', '$compile', '$templateRequest', function($scope, $element, $attrs, $parse, dropdownConfig, uibDropdownServiceNested, $animate, $position, $document, $compile, $templateRequest) {
        var self = this,
            scope = $scope.$new(), // create a child scope so we are not polluting original one
            templateScope,
            appendToOpenClass = dropdownConfig.appendToOpenClass,
            openClass = dropdownConfig.openClass,
            getIsOpen,
            setIsOpen = angular.noop,
            toggleInvoker = $attrs.onToggle ? $parse($attrs.onToggle) : angular.noop,
            keynavEnabled = false,
            selectedOption = null,
            body = $document.find('body');

        $element.addClass('dropdown');

        this.init = function() {
            if ($attrs.isOpen) {
                getIsOpen = $parse($attrs.isOpen);
                setIsOpen = getIsOpen.assign;

                $scope.$watch(getIsOpen, function(value) {
                    scope.isOpen = !!value;
                });
            }

            keynavEnabled = angular.isDefined($attrs.keyboardNav);
        };

        this.toggle = function(open) {
            scope.isOpen = arguments.length ? !!open : !scope.isOpen;
            if (angular.isFunction(setIsOpen)) {
                setIsOpen(scope, scope.isOpen);
            }

            return scope.isOpen;
        };

        // Allow other directives to watch status
        this.isOpen = function() {
            return scope.isOpen;
        };

        scope.getToggleElement = function() {
            return self.toggleElement;
        };

        scope.getAutoClose = function() {
            return $attrs.autoClose || 'always'; //or 'outsideClick' or 'disabled'
        };

        scope.getElement = function() {
            return $element;
        };

        scope.isKeynavEnabled = function() {
            return keynavEnabled;
        };

        scope.focusDropdownEntry = function(keyCode) {
            var elems = self.dropdownMenu ? //If append to body is used.
                angular.element(self.dropdownMenu).find('a') :
                $element.find('ul').eq(0).find('a');

            switch (keyCode) {
                case 40: {
                    if (!angular.isNumber(self.selectedOption)) {
                        self.selectedOption = 0;
                    } else {
                        self.selectedOption = self.selectedOption === elems.length - 1 ?
                            self.selectedOption :
                            self.selectedOption + 1;
                    }
                    break;
                }
                case 38: {
                    if (!angular.isNumber(self.selectedOption)) {
                        self.selectedOption = elems.length - 1;
                    } else {
                        self.selectedOption = self.selectedOption === 0 ?
                            0 : self.selectedOption - 1;
                    }
                    break;
                }
            }
            elems[self.selectedOption].focus();
        };

        scope.getDropdownElement = function() {
            return self.dropdownMenu;
        };

        scope.focusToggleElement = function() {
            if (self.toggleElement) {
                self.toggleElement[0].focus();
            }
        };

        function removeDropdownMenu() {
            $element.append(self.dropdownMenu);
        }

        scope.$watch('isOpen', function(isOpen, wasOpen) {
            var appendTo = null,
                appendToBody = false;

            if (angular.isDefined($attrs.dropdownAppendTo)) {
                var appendToEl = $parse($attrs.dropdownAppendTo)(scope);
                if (appendToEl) {
                    appendTo = angular.element(appendToEl);
                }
            }

            if (angular.isDefined($attrs.dropdownAppendToBody)) {
                var appendToBodyValue = $parse($attrs.dropdownAppendToBody)(scope);
                if (appendToBodyValue !== false) {
                    appendToBody = true;
                }
            }

            if (appendToBody && !appendTo) {
                appendTo = body;
            }

            if (appendTo && self.dropdownMenu) {
                if (isOpen) {
                    appendTo.append(self.dropdownMenu);
                    $element.on('$destroy', removeDropdownMenu);
                } else {
                    $element.off('$destroy', removeDropdownMenu);
                    removeDropdownMenu();
                }
            }

            if (appendTo && self.dropdownMenu) {
                var pos = $position.positionElements($element, self.dropdownMenu, 'bottom-left', true),
                    css,
                    rightalign,
                    scrollbarPadding,
                    scrollbarWidth = 0;

                css = {
                    top: pos.top + 'px',
                    display: isOpen ? 'block' : 'none'
                };

                rightalign = self.dropdownMenu.hasClass('dropdown-menu-right');
                if (!rightalign) {
                    css.left = pos.left + 'px';
                    css.right = 'auto';
                } else {
                    css.left = 'auto';
                    scrollbarPadding = $position.scrollbarPadding(appendTo);

                    if (scrollbarPadding.heightOverflow && scrollbarPadding.scrollbarWidth) {
                        scrollbarWidth = scrollbarPadding.scrollbarWidth;
                    }

                    css.right = window.innerWidth - scrollbarWidth -
                        (pos.left + $element.prop('offsetWidth')) + 'px';
                }

                // Need to adjust our positioning to be relative to the appendTo container
                // if it's not the body element
                if (!appendToBody) {
                    var appendOffset = $position.offset(appendTo);

                    css.top = pos.top - appendOffset.top + 'px';

                    if (!rightalign) {
                        css.left = pos.left - appendOffset.left + 'px';
                    } else {
                        css.right = window.innerWidth -
                            (pos.left - appendOffset.left + $element.prop('offsetWidth')) + 'px';
                    }
                }

                self.dropdownMenu.css(css);
            }

            var openContainer = appendTo ? appendTo : $element;
            var dropdownOpenClass = appendTo ? appendToOpenClass : openClass;
            var hasOpenClass = openContainer.hasClass(dropdownOpenClass);
            var isOnlyOpen = uibDropdownServiceNested.isOnlyOpen($scope, appendTo);

            if (hasOpenClass === !isOpen) {
                var toggleClass;
                if (appendTo) {
                    toggleClass = !isOnlyOpen ? 'addClass' : 'removeClass';
                } else {
                    toggleClass = isOpen ? 'addClass' : 'removeClass';
                }
                $animate[toggleClass](openContainer, dropdownOpenClass).then(function() {
                    if (angular.isDefined(isOpen) && isOpen !== wasOpen) {
                        toggleInvoker($scope, { open: !!isOpen });
                    }
                });
            }

            if (isOpen) {
                if (self.dropdownMenuTemplateUrl) {
                    $templateRequest(self.dropdownMenuTemplateUrl).then(function(tplContent) {
                        templateScope = scope.$new();
                        $compile(tplContent.trim())(templateScope, function(dropdownElement) {
                            var newEl = dropdownElement;
                            self.dropdownMenu.replaceWith(newEl);
                            self.dropdownMenu = newEl;
                            $document.on('keydown', uibDropdownServiceNested.keybindFilter);
                        });
                    });
                } else {
                    $document.on('keydown', uibDropdownServiceNested.keybindFilter);
                }

                scope.focusToggleElement();
                uibDropdownServiceNested.open(scope, $element, appendTo);
            } else {
                uibDropdownServiceNested.close(scope, $element, appendTo);
                if (self.dropdownMenuTemplateUrl) {
                    if (templateScope) {
                        templateScope.$destroy();
                    }
                    var newEl = angular.element('<ul class="dropdown-menu"></ul>');
                    self.dropdownMenu.replaceWith(newEl);
                    self.dropdownMenu = newEl;
                }

                self.selectedOption = null;
            }

            if (angular.isFunction(setIsOpen)) {
                setIsOpen($scope, isOpen);
            }
        });
    }])

    .directive('uibDropdownNested', function() {
        return {
            controller: 'UibDropdownControllerNested',
            link: function(scope, element, attrs, dropdownCtrl) {
                dropdownCtrl.init();
            }
        };
    })

    .directive('uibDropdownMenuNested', function() {
        return {
            restrict: 'A',
            require: '?^uibDropdownNested',
            link: function(scope, element, attrs, dropdownCtrl) {
                if (!dropdownCtrl || angular.isDefined(attrs.dropdownNested)) {
                    return;
                }

                element.addClass('dropdown-menu');

                var tplUrl = attrs.templateUrl;
                if (tplUrl) {
                    dropdownCtrl.dropdownMenuTemplateUrl = tplUrl;
                }

                if (!dropdownCtrl.dropdownMenu) {
                    dropdownCtrl.dropdownMenu = element;
                }
            }
        };
    })

    .directive('uibDropdownToggleNested', function() {
        return {
            require: '?^uibDropdownNested',
            link: function(scope, element, attrs, dropdownCtrl) {
                if (!dropdownCtrl) {
                    return;
                }

                element.addClass('dropdown-toggle');

                dropdownCtrl.toggleElement = element;

                var toggleDropdown = function(event) {
                    event.preventDefault();

                    if (!element.hasClass('disabled') && !attrs.disabled) {
                        scope.$apply(function() {
                            dropdownCtrl.toggle();
                        });
                    }
                };

                element.on('click', toggleDropdown);

                // WAI-ARIA
                element.attr({ 'aria-haspopup': true, 'aria-expanded': false });
                scope.$watch(dropdownCtrl.isOpen, function(isOpen) {
                    element.attr('aria-expanded', !!isOpen);
                });

                scope.$on('$destroy', function() {
                    element.off('click', toggleDropdown);
                });
            }
        };
    });
