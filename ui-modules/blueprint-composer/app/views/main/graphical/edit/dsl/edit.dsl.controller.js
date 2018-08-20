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
import template from './edit.dsl.template.html';
import {Dsl, KIND} from '../../../../../components/util/model/dsl.model';

function EditDslController($scope, $state, $stateParams, objectCache, state) {
    $scope.state = state;

    let dsl = state.rootDsl;
    $scope.breadcrumbs = state.levels.map((level, index) => {
        let ret = {
            index: level + 1,
            dsl: dsl,
            view: {
                name: graphicalEditDslState.name,
                params: {
                    levels: state.levels.slice(0, index).join(',')
                }
            }
        };
        dsl = dsl.params[level + 1];
        return ret;
    });

    $scope.$on('brooklyn.components.dsl-editor.select', (event, data) => {
        let viewName = graphicalEditDslState.name;
        let viewParams = $stateParams;

        updateRootDsl(data.dsl);

        if ($scope.state.levels.length === 0) {
            if ($stateParams.index) {
                $scope.state.entity.config.get($stateParams.for)[$stateParams.index] = $scope.state.rootDsl;
            } else {
                $scope.state.entity.addConfig($stateParams.for, $scope.state.rootDsl);
            }
            objectCache.removeAll();
            viewName = $scope.state.view.name;
            viewParams = $scope.state.view.params;
        } else {
            let levels = angular.copy($scope.state.levels);
            levels.pop();
            viewParams = {levels: levels.join(',')};
        }

        $state.go(viewName, viewParams);
    });

    $scope.$on('brooklyn.components.dsl-editor.nest', (event, data) => {
        if ($scope.state.levels.length === 0 ) {
            $scope.state.rootDsl = data.dsl;
            objectCache.put(`${data.definition.name}.dsl`, $scope.state.rootDsl);
        } else {
            updateRootDsl(data.dsl);
        }

        let levels = angular.copy($scope.state.levels);
        levels.push(data.index);

        $state.go(graphicalEditDslState.name, {levels: levels.join(',')});
    });

    $scope.backUrl = () => {
        return $state.href($scope.state.view.name, $scope.state.view.params);
    };

    function updateRootDsl(dsl) {
        let cachedLevels = angular.copy($scope.state.levels);
        let cachedIndex = cachedLevels.pop();

        if (angular.isDefined(cachedIndex)) {
            cachedLevels
                .reduce((dsl, level) => (dsl.params[level + 1]), $scope.state.rootDsl)
                .params.splice((cachedIndex || 0) + 1, 1, dsl);
        } else {
            $scope.state.rootDsl = dsl;
        }
    }
}

export function dslParamLabelFilter($filter) {
    return function(input) {
        if (input instanceof Dsl) {
            switch (input.kind) {
                case KIND.ENTITY:
                    return 'Entity';
                case KIND.UTILITY:
                case KIND.METHOD:
                    return `Fn: ${input.name}`;
                case KIND.NUMBER:
                    return 'Number';
                case KIND.PORT:
                    return 'Port';
                case KIND.STRING:
                    return 'String';
                case KIND.TARGET:
                    let ret = [];
                    if (input.next) {
                        ret.push($filter('dslParamLabel')(input.next), '@');
                    }
                    ret.push(`Ref: ${input.params[0].name}`);
                    return ret.join(' ');
                default:
                    return input.toString();
            }
        }
        return input;
    }
}

export const graphicalEditDslState = {
    name: 'main.graphical.edit.dsl',
    url: '/dsl/:for/:index?levels',
    params: {
        index: {
            value: '',
            squash: true
        }
    },
    template: template,
    controller: ['$scope', '$state', '$stateParams', 'objectCache', 'state', EditDslController],
    controllerAs: 'vm',
    resolve: {
        state: ['$state', '$stateParams', 'entity', 'brSnackbar', 'objectCache', ($state, $stateParams, entity, brSnackbar, objectCache) => {
            let definition = entity.miscData.get('config').find(config => config.name === $stateParams.for);
            if (!definition) {
                brSnackbar.create(`Config key ${$stateParams.for} does not exist.`);
            }

            let rootDsl = objectCache.get(`${definition.name}.dsl`);
            if (!rootDsl) {
                let config = entity.config.get(definition.name);
                if ($stateParams.index) {
                    config = config[$stateParams.index];
                }
                rootDsl = config instanceof Dsl
                    ? config.clone()
                    : new Dsl(KIND.STRING, '');
                objectCache.put(`${definition.name}.dsl`, rootDsl);
            }

            let view = objectCache.get(`${definition.name}.view`);
            if (!view) {
                view = {
                    name: $state.current.name,
                    params: angular.copy($state.params)
                };
                objectCache.put(`${definition.name}.view`, view);
            }

            let state = {
                entity: entity,
                levels: $stateParams.levels ? $stateParams.levels.split(',').map(num => parseInt(num)) : [],
                rootDsl: rootDsl,
                view: view,
                index: $stateParams.index
            };

            state.dsl = state.levels.length > 0
                ? state.levels.reduce((dsl, level) => (dsl.params[parseInt(level) + 1]), state.rootDsl)
                : state.rootDsl;

            state.definition = Object.assign({}, definition);
            if (state.levels.length > 0 || $stateParams.index) {
                state.definition.type = '.*';
            }

            return state;
        }]
    }
};
