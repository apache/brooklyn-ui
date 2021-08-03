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
import angularSanitize from 'angular-sanitize';
import {Dsl, DslParser, KIND, TARGET} from '../util/model/dsl.model';
import template from './dsl-editor.template.html';
import brAutoFocus from 'brooklyn-ui-utils/autofocus/autofocus';
import brUtils from 'brooklyn-ui-utils/utils/general';

const MODULE_NAME = 'brooklyn.components.dsl-editor';
const TEMPLATE_URL = 'blueprint-composer/component/dsl-editor/index.html';
const DSL_KINDS = {
    ALL: {
        id: 'all',
        label: 'Config, sensor or entity',
    },
    CONFIG: {
        id: 'config',
        label: 'Config'
    },
    SENSOR: {
        id: 'sensor',
        label: 'Sensor'
    },
    ENTITY: {
        id: 'entity',
        label: 'Entity'
    },
    FORMAT_STRING: {
        id: 'formatString',
        label: 'Formatted string'
    },
};

angular.module(MODULE_NAME, [angularSanitize, brAutoFocus, brUtils])
    .directive('dslEditor', ['$rootScope', '$filter', '$log', 'brUtilsGeneral', 'blueprintService', dslEditorDirective])
    .run(['$templateCache', templateCache]);

export default MODULE_NAME;

export function dslEditorDirective($rootScope, $filter, $log, brUtilsGeneral, blueprintService) {
    return {
        restrict: 'E',
        templateUrl: function (tElement, tAttrs) {
            return tAttrs.templateUrl || TEMPLATE_URL;
        },
        scope: {
            definition: '=',
            entity: '=',
            dsl: '='
        },
        link: link
    };

    function link(scope) {
        scope.DSL_KINDS = DSL_KINDS;

        scope.kinds = Object.values(DSL_KINDS);

        scope.filters = [{
            id: 'blueprint',
            label: 'Anywhere on the blueprint',
            scope: 'Global'
        }].concat(getEntityItems(blueprintService.get()).map(item => {
            let attrs = [];
            if (item.entity === scope.entity) {
                attrs.push('this');
            }
            if (!item.entity.hasParent()) {
                attrs.push('root');
            }
            if (scope.entity.parent === item.entity) {
                attrs.push('parent');
            }

            let { name, entity, id } = item;
            name += attrs.length > 0 ? ` (${attrs.join(', ')})` : ` (${entity.id || id})`;

            return {
                id,
                label: name,
                scope: 'On specific entity'
            };
        }));

        scope.orders = [{
            label: 'name',
            property: 'name'
        }, {
            label: 'entity',
            property: 'entity.type'
        }];

        scope.items = [].concat(
            getConfigItems(blueprintService.get(), scope.definition),
            getSensorItems(blueprintService.get()),
            getEntityItems(blueprintService.get(), scope.definition.type)
        );

        scope.state = {
            kind: scope.kinds[0],
            filter: scope.filters[0],
            orderBy: scope.orders[0],
            search: '',
            sensor: false,
            arguments: [],
            toggles: [],
            entityId: '',
        };

        if (scope.dsl) {
            let lastMethod = scope.dsl.getLastMethod();
            if (lastMethod.kind === KIND.METHOD && lastMethod.name === 'config') {
                scope.state.kind = scope.kinds[1];
                scope.state.search = lastMethod.params[0].name;
                scope.state.item = scope.items.find(item => (item.type === DSL_KINDS.CONFIG && item.name === lastMethod.params[0].name));
            }
            if (lastMethod.kind === KIND.METHOD && ['attributeWhenReady', 'sensor'].includes(lastMethod.name)) {
                scope.state.kind = scope.kinds[2];
                scope.state.search = lastMethod.params[0].name;
                scope.state.item = scope.items.find(item => (item.type === DSL_KINDS.SENSOR && item.name === lastMethod.params[0].name));
                scope.state.sensor = lastMethod.name === 'sensor';
            }
            if (lastMethod.kind === KIND.UTILITY && lastMethod.name === 'formatString') {
                scope.state.kind = scope.kinds[4];
                scope.state.pattern = scope.dsl.params[0].name;
                scope.state.arguments = Array.from(scope.dsl.params).splice(1).map(argument => {
                    return argument.kind === KIND.STRING ? argument.name : argument.toString();
                });
            }
            let relatedEntity = scope.dsl.getRoot().relationships.find(entity => entity.id === scope.dsl.params[0].name);
            if (relatedEntity) {
                scope.state.filter = scope.filters.find(filter => filter.id === relatedEntity._id);
            }
        }

        scope.$watch('state.pattern', (newValue, oldValue) => {
            if (!newValue || angular.equals(newValue, oldValue)) {
                return;
            }
            scope.dsl.params.splice(0, 1, new Dsl(KIND.STRING, newValue));
        });

        scope.$watchCollection('state.arguments', (newValue, oldValue) => {
            if (!newValue || angular.equals(newValue, oldValue)) {
                return;
            }
            newValue.forEach((argument, index) => {
                let dsl;
                try {
                    dsl = new DslParser().parseString(argument, scope.entity, blueprintService.get());
                    scope.dsl.params.splice(index + 1, 1, dsl);
                } catch (ex) {
                    $log.debug(`Argument ${index} is not a DSL. Defaulting to string`, ex);
                    dsl = new Dsl(KIND.STRING, argument);
                }
                scope.dsl.params.splice(index + 1, 1, dsl);
            })
        });

        scope.isDsl = (index) => {
            return scope.dsl.params[index + 1] instanceof Dsl && scope.dsl.params[index + 1].kind !== KIND.STRING;
        };

        scope.predicate = (value, index, array) => {
            let predicates = [];

            let validTypes = scope.state.kind.id === DSL_KINDS.ALL.id ? Object.values(DSL_KINDS).filter(type => type !== DSL_KINDS.FORMAT_STRING) : [scope.state.kind];
            predicates.push(validTypes.map(type => type.id).includes(value.type.id));

            if (scope.state.filter.id !== 'blueprint') {
                predicates.push(scope.state.filter.id === value.entity._id);
            }

            if (scope.state.search) {
                let searchPredicate = value.name.toLowerCase().indexOf(scope.state.search.toLowerCase()) > -1;
                if (value.description) {
                    searchPredicate |= value.description.toLowerCase().indexOf(scope.state.search.toLowerCase()) > -1;
                }
                if ([ DSL_KINDS.ENTITY.id, DSL_KINDS.ALL.id ].includes(scope.state.kind.id) ) {
                    // if searching for entity or config/sensors/entity, show everything.
                    // but searching just for a config or sensor doesn't show everything.
                    // (not sure that's the right semantics?)
                    searchPredicate |= value.entity.id && value.entity.id.toLowerCase().indexOf(scope.state.search.toLowerCase()) > -1;
                    searchPredicate |= value.entity.name && value.entity.name.toLowerCase().indexOf(scope.state.search.toLowerCase()) > -1;
                }
                predicates.push(searchPredicate);
            }
            return predicates.reduce((ret, predicate) => (ret && predicate), true);
        };

        scope.selectItem = (item, event) => {
            scope.state.item = item;

            event.preventDefault();
            event.stopPropagation();
        };

        scope.selectDsl = () => {
            scope.dsl = buildDsl();

            $rootScope.$broadcast(`${MODULE_NAME}.select`, {
                dsl: scope.dsl,
                definition: scope.definition
            });
        };

        scope.nestDsl = (index) => {
            scope.dsl = buildDsl();

            $rootScope.$broadcast(`${MODULE_NAME}.nest`, {
                dsl: scope.dsl,
                definition: scope.definition,
                index: index
            });
        };

        scope.isDone = () => {
            if (scope.state.kind.id !== DSL_KINDS.FORMAT_STRING.id) {
                return angular.isDefined(scope.state.item);
            } else {
                return brUtilsGeneral.isNonEmpty(scope.state.pattern) && brUtilsGeneral.isNonEmpty(scope.state.arguments);
            }
        };

        function buildDsl() {
            let dsl;
            let funcDsl;

            if (scope.state.kind.id !== DSL_KINDS.FORMAT_STRING.id) {
                let scopedDsl = getScopedDsl(scope.entity, scope.state.item.entity, scope.state);

                switch (scope.state.item.type) {
                    case DSL_KINDS.CONFIG:
                        funcDsl = new Dsl(KIND.METHOD, 'config').param(new Dsl(KIND.STRING, scope.state.item.name));
                        scopedDsl.chain(funcDsl);
                        dsl = isSelfDsl(scopedDsl) ? funcDsl : scopedDsl;
                        break;
                    case DSL_KINDS.SENSOR:
                        funcDsl = new Dsl(KIND.METHOD, scope.state.sensor ? 'sensor' : 'attributeWhenReady').param(new Dsl(KIND.STRING, scope.state.item.name));
                        scopedDsl.chain(funcDsl);
                        dsl = isSelfDsl(scopedDsl) ? funcDsl : scopedDsl;
                        break;
                    case DSL_KINDS.ENTITY:
                        dsl = scopedDsl;
                        break;
                }
            } else {
                dsl = new Dsl(KIND.UTILITY, 'formatString').param(new Dsl(KIND.STRING, scope.state.pattern));
                scope.state.arguments.forEach((arg, index) => {
                    dsl.param(scope.isDsl(index) ? scope.dsl.params[index + 1] : new Dsl(KIND.STRING, arg));
                });
            }

            try {
                dsl = new DslParser().parseString(dsl.toString(), scope.entity, blueprintService.get());
            } catch (ex) {
                $log.debug(`Cannot get DSL relationship for DSL "${dsl}`, ex);
            }

            return dsl;
        }
    }

    function entityPropertyParserFor(type, filterFunc=()=>true) {
        return (entity, propertyName) => entity.miscData.get(propertyName)
            .filter(filterFunc)
            .map(({ name, description }) => ({
                id: name,
                type,
                entity,
                name,
                description,
            }));
    }

    function uniqueItems(items) {
        const IDs = new Set();

        return items.filter(({ id }) => {
            if (IDs.has(id)) return false;
            IDs.add(id);
            return true;
        })
    }

    function getConfigItems(entity, definition, nested=false) {
        const parseAsConfig = entityPropertyParserFor(DSL_KINDS.CONFIG, item=>item !== definition);

        const result = [
            ...parseAsConfig(entity, 'config'),
            ...parseAsConfig(entity, 'parameters'),
        ];

        Object.values(entity.getClusterMemberspecEntities() || {}).forEach(member => {
            result.push(...getConfigItems(member, definition, true));
        });

        (entity.children || []).forEach(child => {
            result.push(...getConfigItems(child, definition, true));
        });

        return nested
            ? result
            : uniqueItems(result); // only need to check distinct items once, not in every recursion
    }

    function getSensorItems(entity, nested=false) {
        const parseAsSensors = entityPropertyParserFor(DSL_KINDS.SENSOR);

        const result = parseAsSensors(entity, 'sensors');

        Object.values(entity.getClusterMemberspecEntities() || {}).forEach(member => {
            result.push(...getSensorItems(member, true));
        });

        (entity.children || []).forEach(child => {
            result.push(...getSensorItems(child, true));
        });

        return nested
            ? result
            : uniqueItems(result);
    }

    function getEntityItems(entity, nested=false) {
        const result = [{
            id: entity._id,
            type: DSL_KINDS.ENTITY,
            entity: entity,
            name: entity.miscData.get('typeName') || $filter('entityName')(entity) || 'New application',
            description: entity.description
        }];

        Object.values(entity.getClusterMemberspecEntities() || {}).forEach(member => {
            result.push(...getEntityItems(member, true));
        });

        (entity.children || []).forEach(child => {
            result.push(...getEntityItems(child, true));
        });

        return nested
            ? result
            : uniqueItems(result);
    }

    function getScopedDsl(entity, targetEntity, state) {
        if (entity === targetEntity) {
            return new Dsl(KIND.TARGET, TARGET.SELF);
        }
        if (entity.parent === targetEntity) {
            return new Dsl(KIND.TARGET, TARGET.PARENT);
        }

        if (!targetEntity.hasId()) {
            if (brUtilsGeneral.isNonEmpty(state.entityId)) {
                targetEntity.id = state.entityId;
            } else {
                blueprintService.populateId(targetEntity);
            }
        }

        return new Dsl(KIND.TARGET, TARGET.COMPONENT).param(new Dsl(KIND.STRING, targetEntity.id));
    }

    function isSelfDsl(dsl) {
        return dsl && dsl.kind === KIND.TARGET && dsl.name === TARGET.SELF;
    }
}

function templateCache($templateCache) {
    $templateCache.put(TEMPLATE_URL, template);
}
