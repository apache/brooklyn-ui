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
import angularAnimate from 'angular-animate';
import uibModal from 'angular-ui-bootstrap/src/modal/index-nocss';
import template from './bottom-sheet.template.html';

const MODULE_NAME = 'brooklyn.components.bottom-sheet';

const CLASS_ANIMATION_FADE = 'fade';
const CLASS_ANIMATION_SLIDE_UP = 'slide-up';
const CLASS_BACKDROP = 'bottom-sheet-backdrop';
const CLASS_CONTAINER = 'bottom-sheet-container';
const CLASS_MODE_MODAL = 'bottom-sheet-modal';
const CLASS_MODE_INSET = 'bottom-sheet-inset';
const CLASS_OPENED = 'bottom-sheet-open';

const TEMPLATE_CONTAINER_URL = 'br/template/bottom-sheet/window.html';

export const MODES = ['modal', 'inset'];

/**
 * @ngdoc module
 * @name br.bottom-sheet
 * @requires ngAnimate
 * @requires ui.bootstrap.module.modal
 *
 * @description
 * [Bottom sheet UI pattern](https://material.io/guidelines/components/bottom-sheets.html#) implementation for Brooklyn
 */
angular.module(MODULE_NAME, [angularAnimate, uibModal])
    .directive('brBottomSheetBackdrop', ['$animate', brBottomSheetDackdropDirective])
    .directive('brBottomSheetContainer', ['$animate', brBottomSheetContainerDirective])
    .provider('brBottomSheet', brBottomSheetProvider)
    .run(['$templateCache', brBottomSheetRun]);

export default MODULE_NAME;

/**
 * @ngdoc directive
 * @name brBottomSheetBackdrop
 * @module br.bottom-sheet
 * @restrict A
 *
 * @description
 * A helper directive for the `brBottomSheet` service. It creates a backdrop element.
 *
 * @param {string=} animationClass The animation class to use
 * @param {boolean=} animation Whether or not animating the directive
 */
export function brBottomSheetDackdropDirective($animate) {
    return {
        restrict: 'A',
        link: (scope, element, attrs)=> {
            element.addClass(CLASS_BACKDROP);
            if (attrs.animationClass) {
                if (attrs.animation) {
                    $animate.addClass(element, attrs.animationClass)
                } else {
                    element.addClass(attrs.animationClass);
                }
            }
        }
    };
}

/**
 * @ngdoc directive
 * @name brBottomSheetContainer
 * @module br.bottom-sheet
 * @restrict A
 *
 * @description
 * A helper directive for the `brBottomSheet` service. It creates a container element.
 *
 * @param {string=} templateUrl The template URL to use. Default to `br/template/bottom-sheet/window.html`
 * @param {string=} animationClass The animation class to use
 * @param {boolean=} animation Whether or not animating the directive
 */
export function brBottomSheetContainerDirective($animate) {
    return {
        restrict: 'A',
        transclude: true,
        templateUrl: function(tElement, tAttrs) {
            return tAttrs.templateUrl || TEMPLATE_CONTAINER_URL;
        },
        link: (scope, element, attrs)=> {
            element.addClass(CLASS_CONTAINER);
            if (attrs.animationClass) {
                if (attrs.animation) {
                    $animate.addClass(element, attrs.animationClass)
                } else {
                    element.addClass(attrs.animationClass);
                }
            }
        }
    }
}

/**
 * @ngdoc provider
 * @name brBottomSheetProvider
 * @module br.bottom-sheet
 *
 * @description
 * This provider allows you set up global options for the `brBottomSheet` service. It exposes only one method
 * `brBottomSheetProvider.setOption(key, value)`.
 */
export function brBottomSheetProvider() {
    let options = {
        animation: true,
        keyboard: true,
        mode: MODES[0] // Can be either 'modal' or 'inset'
    };

    return {
        /**
         * @ngdoc method
         * @name setOption
         * @methodOf brBottomSheetProvider
         *
         * @description
         * Globally set an option for the `brBottomSheet` service. If an option `key` already exists, it will be overridden.
         *
         * @param {string} key The option key to set
         * @param {string} value The option value to set
         */
        setOption: (key, value)=> {
            if (key) {
                options[key] = value;
            }
        },
        $get: ['$rootScope', '$q', '$document', '$templateRequest', '$controller', '$uibResolve', '$animate', '$compile', ($rootScope, $q, $document, $templateRequest, $controller, $uibResolve, $animate, $compile, $log)=> {
            return new BrBottomSheet($rootScope, $q, $document, $templateRequest, $controller, $uibResolve, $animate, $compile, $log, options);
        }]
    }
}

/**
 * @ngdoc service
 * @name brBottomSheet
 * @module br.bottom-sheet
 *
 * @description
 * This service provides an easy way of displaying a bottom sheet within a page. As per as the
 * [spec](https://material.io/guidelines/components/bottom-sheets.html#), you can have only one bottom sheet at the time
 * therefore if you try to open a bottom sheet but one is already displayed, the previous one will close automatically
 * before the new one appears.
 *
 * The service exposes only one method `brBottomSheet.open(options)` that take an object parameters and return the bottom sheet instance.
 *
 * The scope associated with modal's content is augmented with:
 * - `$close(reason)` (Type: `function`) - A method that can be used to close a bottom sheet, passing a reason.
 * - `$dismiss(reason)` (Type: `function`) - A method that can be used to dismiss a bottom sheet, passing a reason.
 * - `$updateMode(mode)` (Type: `function`) - A method that can be used to update the mode of the current bottom sheet.
 *
 * Those methods make it easy to close a bottom sheet instance without a need to create a dedicated controller.
 * Also, when using `bindToController`, you can define an `$onInit` method in the controller that will fire upon initialization.
 */
function BrBottomSheet($rootScope, $q, $document, $templateRequest, $controller, $uibResolve, $animate, $compile, $log, defaultOptions) {
    // Our bottom sheet instance
    let bottomSheet;

    // We bind to the keydown event listen for the esc key press
    $document.on('keydown', keydownListener);
    // And we unbind ourselve when the rootScope is destroyed
    $rootScope.$on('$destroy', function() {
        $document.off('keydown', keydownListener);
    });

    return {
        /**
         * @ngdoc method
         * @name open
         * @methodOf $brBottomSheet
         *
         * @description
         * Open a new bottom sheet based on the given options. If a bottom sheet is already open, it will be closed automatically
         * first, then open the new one.
         *
         * @param {object} options Options to configure the bottom sheet instance. Supported options are as follow:
         * - `animation` (Type `boolean`, Default: `true`) - Whether or not enable the animation when opening/dismissing the bottom sheet.
         * - `keyboard` (Type `boolean`, Default: `true`) - Whether or not binding the escape key to close the bottom sheet.
         * - `mode` (Type `string`, Default: `modal`) - Set the mode of the bottom sheet. Can be `modal` or `inset`.
         *   If `modal`, the bottom sheet will then take the full focus of the window with a backdrop behind. `inset` will
         *   display the bottom sheet on top of the current content but will allow a user to interact with the application behind.
         * - `backdropClass` (Type `string`) - Custom CSS class to add to the backdrop DOM element.
         * - `backdropAnimationClass` (Type `string`, Default: `fade`) - Custom CSS animation class to add to the backdrop
         *   DOM element. Setting this class will override the default animation.
         * - `containerClass` (Type `string`) - Custom CSS class to add to the bottom sheet container DOM element.
         * - `containerAnimationClass` (Type `string`, Default: `fade slide-up`) - Custom CSS animation class to add to the
         *   bottom sheet containet DOM element. Setting this class will override the default animation.
         * - `containerTemplateUrl` (Type `string`, Default: `br/template/bottom-sheet/window.html`) - Custom template to use
         *   for the bottom sheet container. This expect a URL so the template can either be added as a standalone HTML or
         *   added via `$templateCache` service
         * - `openedClass` (Type `string`, Default: `bottom-sheet-open`) - Custom CSS class to add to the `appendTo` DOM element
         *   when the bottom sheet is opened.
         * - `appendTo` (Type: `angular.element,` Default: `body`) - DOM element to append the bottom sheet to.
         * - `bindToController` (Type: `boolean`, Default: `false`) - When used with `controllerAs` & set to `true`, it will
         *   bind the `$scope` properties onto the controller.
         * - `template` (Type: `string`) - Inline template representing the bottom sheet's content.
         * - `templateUrl` (Type: `string`) - A path to a template representing bottom sheet's content. You need either a `template` or `templateUrl`.
         * - `resolve` (Type: `Object`) - Members that will be resolved and passed to the controller as locals;
         *   it is equivalent of the `resolve` property in the router.
         * - `scope` (Type: `$scope`) - The parent scope instance to be used for the bottom sheet's content. Defaults to `$rootScope`.
         *
         * @returns {object} The bottom sheet instance containing the following properties:
         * - `close(result)` (Type: `function`) - Can be used to close a modal, passing a result.
         * - `dismiss(reason)` (Type: `function`) - Can be used to dismiss a modal, passing a reason.
         * - `updateMode(mode)` (Type: `function`) - Can be used to change the current bottom sheet `mode`.
         * - `result` (Type: `promise`) - Is resolved when a modal is closed and rejected when a modal is dismissed.
         * - `opened` (Type: `promise`) - Is resolved when a modal gets opened after downloading content's template and resolving all variables.
         * - `closed` (Type: `promise`) - Is resolved when a modal is closed and the animation completes.
         * - `rendered` (Type: `promise`) - Is resolved when a modal is rendered.
         */
        open: (options)=> {
            if (bottomSheet) {
                // If there is a bottom sheet already, we trigger a dismiss (unless it already has been marked as destroyed)
                // then we wait until it has been fully removed to launch the new instance.
                if (!bottomSheet.scope.$$brDestructionScheduled) {
                    close('New bottom sheet on the queue', true);
                }
                bottomSheet.closedDeferred.promise.then(()=> {
                    open(options);
                });
            } else {
                open(options);
            }
        }
    };

    function open(options) {
        options = angular.extend({}, defaultOptions, options);
        options.resolve = options.resolve || {};
        options.appendTo = options.appendTo || $document.find('body').eq(0);

        // Perform some validations on options
        if (MODES.indexOf(options.mode) === -1) {
            throw new Error('"mode" not supported. Make sure that the mode is one of those: ' + MODES);
        }
        if (!options.appendTo.length) {
            throw new Error('"appendTo" element not found. Make sure that the element passed is in DOM.');
        }
        if (!options.template && !options.templateUrl) {
            throw new Error('One of "template" or "templateUrl" options is required.');
        }

        // Create promises
        let bottomSheetResultDeferred = $q.defer();
        let bottomSheetOpenedDeferred = $q.defer();
        let bottomSheetClosedDeferred = $q.defer();
        let bottomSheetRenderDeferred = $q.defer();
        let promises = $q.all([
            getTemplatePromise(options),
            $uibResolve.resolve(options.resolve, {}, null, null)
        ]);

        // Create bottom sheet instance
        let bottomSheetInstance = {
            result: bottomSheetResultDeferred.promise,
            opened: bottomSheetOpenedDeferred.promise,
            closed: bottomSheetClosedDeferred.promise,
            rendered: bottomSheetRenderDeferred.promise,
            close: (reason)=> {
                close(reason, true);
            },
            dismiss: (reason)=> {
                close(reason, false);
            },
            updateMode: (mode)=> {
                updateMode(mode);
            }
        };

        // Let's create our bottom sheet instance
        promises.then((tplAndVars)=> {
            let providedScope = options.scope || $rootScope;

            let bottomSheetScope = providedScope.$new();
            bottomSheetScope.$close = bottomSheetInstance.close;
            bottomSheetScope.$dismiss = bottomSheetInstance.dismiss;
            bottomSheetScope.$updateMode = bottomSheetInstance.updateMode;

            bottomSheetScope.$on('$destroy', function() {
                if (!bottomSheetScope.$$brDestructionScheduled) {
                    bottomSheetScope.$dismiss('$brUnscheduledDestruction');
                }
            });

            bottomSheet = {
                scope: bottomSheetScope,
                deferred: bottomSheetResultDeferred,
                renderDeferred: bottomSheetRenderDeferred,
                closedDeferred: bottomSheetClosedDeferred,
                animation: options.animation,
                keyboard: options.keyboard,
                mode: options.mode,
                backdropClass: options.backdropClass,
                backdropAnimationClass: options.backdropAnimationClass,
                containerClass: options.containerClass,
                containerAnimationClass: options.containerAnimationClass,
                containerTemplateUrl: options.containerTemplateUrl,
                openedClass: options.openedClass,
                appendTo: options.appendTo,
                content: tplAndVars[0],
                ariaLabelledBy: options.ariaLabelledBy,
                ariaDescribedBy: options.ariaDescribedBy,
            };

            // We create our own instance of controller, based on the given options
            let ctrlInstance, ctrlInstantiate, ctrlLocals = {};

            ctrlLocals.$scope = bottomSheetScope;
            ctrlLocals.$scope.$resolve = {};
            ctrlLocals.brBottomSheetInstance = bottomSheetInstance;

            // If we passed a resolve block, all vars are injected into the local controller scope
            let resolves = tplAndVars[1];
            angular.forEach(resolves, function(value, key) {
                ctrlLocals[key] = value;
                ctrlLocals.$scope.$resolve[key] = value;
            });

            // the third param will make the controller instantiate later,private api
            // @see https://github.com/angular/angular.js/blob/master/src/ng/controller.js#L126
            ctrlInstantiate = $controller(options.controller, ctrlLocals, true, options.controllerAs);
            if (options.controllerAs && options.bindToController) {
                ctrlInstance = ctrlInstantiate.instance;
                ctrlInstance.$close = bottomSheetScope.$close;
                ctrlInstance.$dismiss = bottomSheetScope.$dismiss;
                angular.extend(ctrlInstance, {
                    $resolve: ctrlLocals.$scope.$resolve
                }, providedScope);
            }

            ctrlInstance = ctrlInstantiate();

            if (angular.isFunction(ctrlInstance.$onInit)) {
                ctrlInstance.$onInit();
            }

            // Create the backdrop if the mode is set to 'modal'
            if (options.mode === MODES[0]) {
                createBackdrop();
            }

            bottomSheet.containerElm = angular.element('<div br-bottom-sheet-container></div>');
            bottomSheet.containerElm.attr({
                'class': bottomSheet.containerClass,
                'animation-class': bottomSheet.containerAnimationClass || CLASS_ANIMATION_SLIDE_UP + ' ' + CLASS_ANIMATION_FADE,
                'role': 'dialog',
                'tabindex': -1,
            }).append(bottomSheet.content);
            if (bottomSheet.containerTemplateUrl) {
                bottomSheet.containerElm.attr('template-url', bottomSheet.containerTemplateUrl);
            }
            if (bottomSheet.animation) {
                bottomSheet.containerElm.attr('animation', 'true');
            }

            let bodyClass = bottomSheet.openedClass || CLASS_OPENED;
            bottomSheet.appendTo.addClass(bodyClass);
            if (bottomSheet.mode === MODES[0]) {
                bottomSheet.appendTo.addClass(CLASS_MODE_MODAL);
            }
            if (bottomSheet.mode === MODES[1]) {
                bottomSheet.appendTo.addClass(CLASS_MODE_INSET);
            }
            $animate.enter($compile(bottomSheet.containerElm)(bottomSheet.scope), bottomSheet.appendTo);

            // Focus on the newly created bottom sheet
            bottomSheet.containerElm[0].focus();

            bottomSheetOpenedDeferred.resolve(true);
        }).catch((reason)=> {
            bottomSheetOpenedDeferred.reject(reason);
            bottomSheetResultDeferred.reject(reason);
        });

        return bottomSheetInstance;
    }

    function close(reason, dismiss = false) {
        bottomSheet.scope.$$brDestructionScheduled = true;

        // Removing the backdrop, if exists
        if (bottomSheet.mode === 'modal' && bottomSheet.backdropElm && bottomSheet.backdropScope) {
            removeAfterAnimate(bottomSheet.backdropElm, bottomSheet.backdropScope, ()=> {
                bottomSheet.backdropElm = undefined;
                bottomSheet.backdropScope = undefined;
            });
        }
        // Removing the bottom sheet
        removeAfterAnimate(bottomSheet.containerElm, bottomSheet.scope, ()=> {
            let bodyClass = bottomSheet.openedClass || CLASS_OPENED;
            bottomSheet.appendTo.removeClass(bodyClass, CLASS_MODE_MODAL, CLASS_MODE_INSET);
            bottomSheet = undefined;
        }, bottomSheet.closedDeferred);

        if (dismiss) {
            bottomSheet.deferred.reject(reason);
        } else {
            bottomSheet.deferred.resolve(reason);
        }

        // Move focus on the appendTo element
        bottomSheet.appendTo[0].focus();
    }

    function updateMode(mode) {
        if (MODES.indexOf(mode) === -1) {
            $log.error('Mode ' + mode + ' is not supported. You can choose from the following list: ' + MODES);
            return;
        }

        if (!bottomSheet || bottomSheet.mode === mode) {
            return;
        }

        bottomSheet.appendTo.removeClass(CLASS_MODE_MODAL, CLASS_MODE_INSET);

        switch (mode) {
            case MODES[0]:
                createBackdrop().then(()=> {
                    bottomSheet.mode = mode;
                    bottomSheet.appendTo.addClass(CLASS_MODE_MODAL);
                });
                break;
            case MODES[1]:
                removeAfterAnimate(bottomSheet.backdropElm, bottomSheet.backdropScope, ()=> {
                    bottomSheet.mode = mode;
                    bottomSheet.appendTo.addClass(CLASS_MODE_INSET);
                });
                break;
        }
    }

    function keydownListener(event) {
        if (event.isDefaultPrevented()) {
            return event;
        }

        if (bottomSheet && bottomSheet.keyboard) {
            switch (event.which) {
                case 27: {
                    if (bottomSheet.keyboard) {
                        event.preventDefault();
                        $rootScope.$apply(()=> {
                            close('Escape key pressed', true);
                        });
                    }
                    break;
                }
            }
        }
    }

    function createBackdrop(done) {
        if (!bottomSheet || bottomSheet.mode === 'inset') {
            return;
        }

        bottomSheet.backdropScope = $rootScope.$new(true);
        bottomSheet.backdropElm = angular.element('<div br-bottom-sheet-backdrop></div>');
        bottomSheet.backdropElm.attr({
            'class': bottomSheet.backdropClass,
            'animation-class' : bottomSheet.backdropAnimationClass || CLASS_ANIMATION_FADE
        });
        if (bottomSheet.animation) {
            bottomSheet.backdropElm.attr('animation', 'true');
        }
        $compile(bottomSheet.backdropElm)(bottomSheet.backdropScope);
        $animate.enter(bottomSheet.backdropElm, bottomSheet.appendTo).then(()=> {
            if (done) {
                done();
            }
        })
    }

    function removeAfterAnimate(domEl, scope, done, closedDeferred) {
        $animate.leave(domEl).then(function() {
            if (done) {
                done();
            }

            domEl.remove();
            if (closedDeferred) {
                closedDeferred.resolve();
            }
        });

        scope.$destroy();
    }

    function getTemplatePromise(options) {
        return options.template ? $q.when(options.template) :
            $templateRequest(angular.isFunction(options.templateUrl) ?
                options.templateUrl() : options.templateUrl);
    }
}

export function brBottomSheetRun($templateCache) {
    $templateCache.put(TEMPLATE_CONTAINER_URL, template);
}
