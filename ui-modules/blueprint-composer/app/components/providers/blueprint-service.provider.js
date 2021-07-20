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
import {Entity, EntityFamily} from "../util/model/entity.model";
import {Issue, ISSUE_LEVEL} from '../util/model/issue.model';
import {Dsl} from "../util/model/dsl.model";
import jsYaml from "js-yaml";
import typeNotFoundIcon from "../../img/icon-not-found.svg";

const MODULE_NAME = 'brooklyn.composer.service.blueprint-service';
const TAG = 'SERVICE :: BLUEPRINT :: ';

angular.module(MODULE_NAME, [])
    .provider('blueprintService', blueprintServiceProvider);

export default MODULE_NAME;

export const RESERVED_KEYS = ['name', 'location', 'locations', 'type', 'services', 'brooklyn.config', 'brooklyn.children', 'brooklyn.enrichers', 'brooklyn.policies'];
export const DSL_ENTITY_SPEC = '$brooklyn:entitySpec';

export const COMMON_HINTS = {
    'config-quick-fixes': [{
        key: '.*',
        fix: 'explicit_config',
        'message-regex': /implicitly defined/i
    }]
};

export function blueprintServiceProvider() {
    return {
        $get: ['$log', '$q', '$sce', 'paletteApi', 'iconGenerator', 'dslService', 'brBrandInfo',
            function ($log, $q, $sce, paletteApi, iconGenerator, dslService, brBrandInfo) {
                return new BlueprintService($log, $q, $sce, paletteApi, iconGenerator, dslService, brBrandInfo);
            }]
    }
}

function BlueprintService($log, $q, $sce, paletteApi, iconGenerator, dslService, brBrandInfo) {
    let blueprint = new Entity();
    let entityRelationshipProviders = {};

    // Add relationships provider based on Entity.config
    addEntityRelationshipsProvider( 'config',{
        apply: (entity) => {
            let set = Array.from(entity.config.keys())
                .reduce((set, key)=> {
                    let config = entity.config.get(key);
                    if (config instanceof Dsl) {
                        config.relationships.forEach((entity) => {
                            if (entity !== null) {
                                set.add({entity: entity, name: key});
                            }
                        });
                    }
                    if (config instanceof Array) {
                        console.log('Array',config)
                        config
                            .filter(item => item instanceof Dsl)
                            .reduce((set, config) => {
                                config.relationships.forEach((entity) => {
                                    if (entity !== null) {
                                        set.add({entity: entity, name: key});
                                    }
                                });
                                return set;
                            }, set);
                    }
                    if (config instanceof Object) {
                        Object.keys(config)
                            .filter(objectKey => config[objectKey] instanceof Dsl)
                            .reduce((set, objectKey) => {
                                config[key].relationships.forEach((entity)=> {
                                    if (entity !== null) {
                                        set.add({entity: entity, name: key});
                                    }
                                });
                                return set;
                            }, set);
                    }
                    return set;
                }, new Set());

            return Array.from(set).map((relation) => {
                return {
                    source: entity,
                    target: relation.entity,
                    label: relation.name,
                    pathSelector: 'relation-selector', // the CSS class for path
                    labelSelector: 'relation-selector', // the CSS class for label
                };
            });
        }
    });

    // Add relationships provider based on Entity spec
    addEntityRelationshipsProvider('spec', {
        apply: (entity) => {
            return Array.from(entity.config.values())
                .filter(config => config && config[DSL_ENTITY_SPEC] && config[DSL_ENTITY_SPEC] instanceof Entity)
                .map(config => config[DSL_ENTITY_SPEC])
                .reduce((relationships, spec) => relationships.concat(getRelationships(spec)), []);
        }
    });

    return {
        setFromJson: setBlueprintFromJson,
        setFromYaml: setBlueprintFromYaml,
        get: getBlueprint,
        getAsJson: getBlueprintAsJson,
        getAsYaml: getBlueprintAsYaml,
        reset: resetBlueprint,
        find: findEntity,
        findAny: findAnyEntity,
        getEntityMetadata: getEntityMetadata,
        entityHasMetadata: entityHasMetadata,
        refreshBlueprintMetadata: refreshBlueprintMetadata,
        refreshEntityMetadata: refreshEntityMetadata,
        refreshConfigConstraints: refreshConfigConstraints,
        refreshRelationships: refreshRelationships,
        refreshAllRelationships: refreshAllRelationships,
        refreshConfigInherited: refreshConfigInherited,
        addRelationshipsProvider: addEntityRelationshipsProvider,
        isReservedKey: isReservedKey,
        getIssues: getIssues,
        hasIssues: hasIssues,
        clearAllIssues: clearAllIssues,
        getAllIssues: getAllIssues,
        populateEntityFromApi: populateEntityFromApiSuccess,
        populateLocationFromApi: populateLocationFromApiSuccess,
        addConfigKeyDefinition: addConfigKeyDefinition,
        addParameterDefinition: addParameterDefinition,
        getRelationships: getRelationships,
        populateId: populateId,
    };

    function setBlueprintFromJson(jsonBlueprint) {
        if (jsonBlueprint) {
            blueprint.setEntityFromJson(jsonBlueprint);
            $log.debug(TAG + 'Blueprint set from JS', blueprint);
        } else {
            resetBlueprint();
        }
    }

    function setBlueprintFromYaml(yamlBlueprint, reset = false) {
        let newBlueprint = jsYaml.safeLoad(yamlBlueprint);
        if (reset) {
            resetBlueprint();
        }
        setBlueprintFromJson(newBlueprint);
        $log.debug(TAG + 'Blueprint set from YAML', blueprint);
        // do we need to refresh the blueprint now?  see comments in yaml.state.js and on refreshBlueprint; think not.
    }

    function getBlueprint() {
        return blueprint;
    }

    function getBlueprintAsJson() {
        return blueprint.getData();
    }

    function getBlueprintAsYaml() {
        try {
            let currentModel = blueprint.getData();
            return (Object.keys(currentModel).length === 0) ? '' : jsYaml.safeDump(currentModel, { lineWidth: 127 });
        } catch (err) {
            $log.error("Error converting brooklyn blueprint (rethrowing)", err);
            throw 'Could not convert the Brooklyn blueprint into YAML format';
        }
    }

    function resetBlueprint() {
        blueprint.reset();
    }

    function findEntity(id) {
        if (!id) {
            return null;
        }
        return lookup(blueprint, id);
    }


    function findAnyEntity(id) {
        if (!id) {
            return null;
        }
        return lookup(blueprint, id, true);
    }

    function getEntityMetadata(entity) {
        let metadata = new Map();
        if (entity instanceof Entity) {
            entity.metadata.forEach((value, key)=> {
                if (RESERVED_KEYS.indexOf(key) === -1) {
                    metadata.set(key, value);
                }
            });
        }
        return metadata;
    }

    function entityHasMetadata(entity) {
        return this.getEntityMetadata(entity).size > 0;
    }

    function isReservedKey(key) {
        return RESERVED_KEYS.indexOf(key) > -1;
    }

    function getIssues(entity = blueprint, nonRecursive) {
        let issues = [];

        if (entity.hasIssues()) {
            issues = issues.concat(entity.issues.map((issue) => {
                let newIssue = Issue.builder().message(issue.message).group(issue.group).ref(issue.ref).level(issue.level).build();
                newIssue.entity = entity;
                return newIssue;
            }));
        }

        entity.policies.forEach((policy) => {
            issues = issues.concat(getIssues(policy));
        });

        entity.enrichers.forEach((enricher) => {
            issues = issues.concat(getIssues(enricher));
        });

        if (!nonRecursive) {
            entity.children.forEach((child) => {
                issues = issues.concat(getIssues(child));
            });
        }

        return issues;
    }

    // typically followed by a call to refresh
    function clearAllIssues(entity = blueprint) {
        entity.resetIssues();
        entity.children.forEach(clearAllIssues);
    }

    function getAllIssues(entity = blueprint) {
        return collectAllIssues({}, entity);
    }

    function collectAllIssues(result, entity) {
        if (!result.entities) {
            result.entities = {};
            result.byEntity = {};
            result.count = 0;
            result.errors = { byEntity: {}, count: 0 }
            result.warnings = { byEntity: {}, count: 0 }
        }
        if (result.entities[entity._id]) {
            // already visited, some sort of reference; ignore
        } else {
            result.entities[entity._id] = entity;

            let issues = getIssues(entity, true);
            if (issues.length) {
                result.byEntity[entity._id] = issues;
                result.count += issues.length;

                let errors = issues.filter(i => i.level.id == 'error');
                if (errors.length) {
                    result.errors.byEntity[entity._id] = errors;
                    result.errors.count += errors.length;
                }

                let warnings = issues.filter(i => i.level.id != 'error');
                if (warnings.length) {
                    result.warnings.byEntity[entity._id] = warnings;
                    result.warnings.count += warnings.length;
                }
            }

            entity.children.forEach((child)=> collectAllIssues(result, child));
        }
        return result;
    }

    function hasIssues() {
        return this.getIssues().length > 0;
    }

    function lookup(entity, id, any = false) {
        if (entity._id === id) {
            return entity;
        }
        if (entity.childrenAsMap.has(id)) {
            return entity.childrenAsMap.get(id);
        }
        if (entity.policies.has(id)) {
            return entity.policies.get(id);
        }
        if (entity.enrichers.has(id)) {
            return entity.enrichers.get(id);
        }
        let memberSpecs = Object.values(entity.getClusterMemberspecEntities()).filter((memberSpec)=>(memberSpec._id === id));
        if (memberSpecs.length === 1) {
            return memberSpecs[0];
        }
        for (let child of entity.childrenAsMap.values()) {
            let ret = lookup(child, id, any);
            if (ret !== null) {
                return ret;
            }
        }
        return null;
    }

    function refreshBlueprintMetadata(entity = blueprint, family = 'ENTITY') {
        // TODO ideally we'd have a cache for all types
        return refreshEntityMetadata(entity, family).then(()=> {
            return $q.all(entity.children.reduce((result, child) => {
                result.push(refreshBlueprintMetadata(child));
                return result;
            }, []));
        }).then(() => {
            return entity;
        });
    }

    function refreshEntityMetadata(entity, family) {
        entity.miscData.set('loading', true);
        return $q.all([refreshTypeMetadata(entity, family), refreshLocationMetadata(entity)]).then(()=> {
            entity.miscData.set('loading', false);
            return refreshRelationships(entity);
        }).then(() => {
            return $q.all([
                refreshConfigConstraints(entity),
                refreshConfigMemberspecsMetadata(entity),
                refreshPoliciesMetadata(entity),
                refreshEnrichersMetadata(entity),
                refreshConfigInherited(entity)
            ]);
        }).then(()=> {
            return entity;
        });
    }

    function refreshTypeMetadata(entity, family) {
        let deferred = $q.defer();
        if (entity.hasType()) {
            entity.family = family.id;

            let promise = entity.miscData.has('bundle')
                ? paletteApi.getBundleType(entity.miscData.get('bundle').symbolicName, entity.miscData.get('bundle').version, entity.type, entity.version, entity.config)
                : paletteApi.getType(entity.type, entity.version, entity.config);

            promise.then((data)=> {
                deferred.resolve(populateEntityFromApiSuccess(entity, data));
            }).catch(function (error) {
                deferred.resolve(populateEntityFromApiError(entity, error));
            });
        } else {
            if (entity.parent) {
                entity.clearIssues({group: 'type'}).addIssue(Issue.builder().group('type').message('Entity needs a type').level(ISSUE_LEVEL.WARN).build());
            }
            entity.miscData.set('sensors', []);
            entity.miscData.set('traits', []);

            entity.clearIssues({group: 'config'});
            entity.miscData.set('config', []);
            entity.miscData.set('configMap', {});
            entity.miscData.set('parameters', []);
            entity.miscData.set('parametersMap', {});

            addUnlistedConfigKeysDefinitions(entity);
            addUnlistedParameterDefinitions(entity);

            deferred.resolve(entity);
        }

        return deferred.promise;
    }

    function locationType(location) {
        if (!location || typeof location === 'string') return location;
        if (typeof location === 'object' && Object.keys(location).length==1) return Object.keys(location)[0];
        return null;
    }

    function refreshLocationMetadata(entity) {
        let deferred = $q.defer();

        if (entity.hasLocation()) {
            let type = locationType(entity.location);
            if (type && type.startsWith) {
                if (type.startsWith("jclouds:")) {
                    // types eg jclouds:aws-ec2 are low-level, not in the catalog
                    deferred.resolve(populateLocationFromApiSuccess(entity, { yamlHere: entity.location }));
                } else {
                    paletteApi.getLocation(locationType(entity.location)).then((location) => {
                        let loc = Object.assign({}, location.catalog || location, {yamlHere: entity.location});
                        deferred.resolve(populateLocationFromApiSuccess(entity, loc));
                    }).catch(function () {
                        deferred.resolve(populateLocationFromApiError(entity));
                    });
                }
            } else {
                deferred.resolve(entity);
            }
        } else {
            deferred.resolve(entity);
        }

        return deferred.promise;
    }

    function refreshConfigConstraints(entity) {
        function checkConstraints(config) {
            for (let constraintO of config.constraints) {
                let message = null;
                let key = null, args = null;
                if (constraintO instanceof String || typeof constraintO=='string') {
                    key = constraintO;
                } else if (Object.keys(constraintO).length==1) {
                    key = Object.keys(constraintO)[0];
                    args = constraintO[key];
                } else {
                    $log.warn("Unknown constraint object", typeof constraintO, constraintO, config);
                    key = constraintO;
                }
                let val = (k) => entity.config.get(k || config.name);
                let isSet = (k) => entity.config.has(k || config.name) && angular.isDefined(val(k));
                let isAnySet = (k) => {
                    if (!k || !Array.isArray(k)) return false;
                    return k.some(isSet);
                }
                let hasDefault = () => angular.isDefined(config.defaultValue);
                switch (key) {
                    case 'Predicates.notNull()':
                    case 'Predicates.notNull':
                        if (!isSet() && !hasDefault()) {
                            message = `<samp>${config.name}</samp> is required`;
                        }
                        break;
                    case 'required':
                        if (!isSet() && !hasDefault() && val()!='') {
                            message = `<samp>${config.name}</samp> is required`;
                        }
                        break;
                    case 'regex':
                        if (isSet() && !(new RegExp(args).test(val))) {
                            message = `<samp>${config.name}</samp> does not match the required format: <samp>${args}</samp>`;
                        }
                        break;
                    case 'forbiddenIf':
                        if (isSet() && isSet(args)) {
                            message = `<samp>${config.name}</samp> and <samp>${args}</samp> cannot both be set`;
                        }
                        break;
                    case 'forbiddenUnless':
                        if (isSet() && !isSet(args)) {
                            message = `<samp>${config.name}</samp> can only be set when <samp>${args}</samp> is set`;
                        }
                        break;
                    case 'requiredIf':
                        if (!isSet() && isSet(args)) {
                            message = `<samp>${config.name}</samp> must be set if <samp>${args}</samp> is set`;
                        }
                        break;
                    case 'requiredUnless':
                        if (!isSet() && !isSet(args)) {
                            message = `<samp>${config.name}</samp> or <samp>${args}</samp> is required`;
                        }
                        break;
                    case 'requiredUnlessAnyOf':
                        if (!isSet() && !isAnySet(args)) {
                            message = `<samp>${config.name}</samp> or one of <samp>${args}</samp> is required`;
                        }
                        break;
                    case 'forbiddenUnlessAnyOf':
                        if (isSet() && !isAnySet(args)) {
                            message = `<samp>${config.name}</samp> cannot be set if any of <samp>${args}</samp> are set`;
                        }
                        break;
                    default:
                        $log.warn("Unknown constraint predicate", constraintO, config);
                }
                if (message !== null) {
                    entity.addIssue(Issue.builder().group('config').ref(config.name).message($sce.trustAsHtml(message)).build());
                }
            }
        }
        return $q((resolve) => {
            if (entity.miscData.has('config')) {
                entity.miscData.get('config')
                    .filter(config => config.constraints && config.constraints.length > 0)
                    .forEach(checkConstraints);
            }
            // could do same as above to check parameters, but that doesn't make the parameters appear as config to set,
            // so instead we merge parameters with config
            resolve();
        });
    }

    function refreshConfigMemberspecsMetadata(entity) {
        let promiseArray = [];
        Object.values(entity.getClusterMemberspecEntities()).forEach((memberSpec)=> {
            // memberSpec can be `undefined` if the member spec is not a `$brooklyn:entitySpec`, e.g. it is `$brooklyn:config("spec")`.
            // there may be a better way but this seems to handle it.
            if (memberSpec) promiseArray.push(refreshBlueprintMetadata(memberSpec, 'SPEC'));
        });
        return $q.all(promiseArray);
    }

    function refreshPoliciesMetadata(entity) {
        return $q.all(entity.getPoliciesAsArray().reduce((result, policy)=> {
            policy.miscData.set('loading', true);
            policy.family = 'POLICY';

            let deferred = $q.defer();

            paletteApi.getType(policy.type, policy.version).then((data)=> {
                deferred.resolve(populateEntityFromApiSuccess(policy, data));
            }).catch(function (error) {
                deferred.resolve(populateEntityFromApiError(policy, error));
            }).finally(()=> {
                policy.miscData.set('loading', false);
            });
            result.push(deferred);
            return result;
        }, []));
    }

    function refreshEnrichersMetadata(entity) {
        return $q.all(entity.getEnrichersAsArray().reduce((result, enricher)=> {
            enricher.miscData.set('loading', true);
            enricher.family = 'ENRICHER';

            let deferred = $q.defer();

            paletteApi.getType(enricher.type, enricher.version).then((data)=> {
                deferred.resolve(populateEntityFromApiSuccess(enricher, data));
            }).catch(function (error) {
                deferred.resolve(populateEntityFromApiError(enricher, error));
            }).finally(()=> {
                enricher.miscData.set('loading', false);
            });
            result.push(deferred);
            return result;
        }, []));
    }

    function refreshConfigInherited(entity) {
        return $q((resolve) => {
            (Array.isArray(entity.miscData.get('config')) ? entity.miscData.get('config') : [])
                .filter(definition => !entity.config.has(definition.name))
                .forEach(definition => {
                    if (entity.hasInheritedConfig(definition.name)) {
                        entity.addIssue(Issue.builder()
                            .group('config')
                            .ref(definition.name)
                            .level(ISSUE_LEVEL.WARN)
                            .message(`Implicitly defined from one of its ancestor`)
                            .build());
                    }
                });
            resolve();
        });
    }

    function parseInput(input, entity) {
        return $q((resolve, reject) => {
            try {
                let parsed = dslService.parse(input, entity, getBlueprint());
                if (parsed.kind && parsed.kind.family === 'constant') {
                    reject('constants not interpreted as DSL when parsed', input);
                } else {
                    resolve(parsed);
                }
            } catch (ex) {
                $log.debug("Cannot detect whether this is a DSL expression; assuming not", ex);
                reject(ex, input);
            }
        });
    }

    function refreshRelationships(entity) {
        return $q.all(Array.from(entity.config.keys()).reduce((promises, key) => {
            let value = entity.config.get(key);

            // Return promises that returns an object like { key: "my-config-key-key", issues: [] }
            if (value instanceof Dsl) {
                promises.push(
                    parseInput(value.toString(), entity).then(dsl => {
                        entity.config.set(key, dsl);
                        return {
                            key: key,
                            issues: dsl.getAllIssues()
                        };
                    }).catch(() => $q.resolve({
                        key: key,
                        issues: []
                    }))
                );
            } else if (value instanceof Array) {
                promises.push(
                    $q.all(value.reduce((issues, itemValue, itemIndex) => {
                        return issues.concat(
                            parseInput(itemValue, entity).then(dsl => {
                                value[itemIndex] = dsl;
                                return dsl.getAllIssues();
                            }).catch(() => [])
                        );
                    }, [])).then(issues => {
                        return {
                            key: key,
                            issues: issues.reduce((acc, issue) => acc.concat(issue), [])
                        }
                    })
                );
            } else if (value instanceof Object) {
                promises.push(
                    $q.all(Object.keys(value).reduce((issues, itemKey) => {
                        return issues.concat(
                            parseInput(value[itemKey], entity).then(dsl => {
                                value[itemKey] = dsl;
                                return dsl.getAllIssues();
                            }).catch(() => [])
                        );
                    }, [])).then(issues => {
                        return {
                            key: key,
                            issues: issues.reduce((acc, issue) => acc.concat(issue), [])
                        }
                    })
                );
            } else {
                promises.push(
                    parseInput(value, entity).then(dsl => {
                        entity.config.set(key, dsl);
                        return {
                            key: key,
                            issues: dsl.getAllIssues()
                        };
                    }).catch(() => $q.resolve({
                        key: key,
                        issues: []
                    }))
                );
            }

            return promises;
        }, [])).then(results => {
            results.forEach(result => {
                entity.clearIssues({ref: result.key, phase: 'relationship'});
                result.issues.forEach(issue => {
                    entity.addIssue(Issue.builder().group('config').phase('relationship').ref(result.key).message($sce.trustAsHtml(issue)).build());
                });
            })
        });
    }

    function refreshAllRelationships(entity = blueprint) {
        let promises = [];
        promises.push(refreshRelationships(entity));
        promises.concat(entity.children.map(child => refreshAllRelationships(child)));

        return $q.all(promises);
    }

    function addConfigKeyDefinition(entity, key) {
        entity.addConfigKeyDefinition(key, false);
    }

    function addParameterDefinition(entity, key) {
        entity.addParameterDefinition(key);
    }

    function addUnlistedConfigKeysDefinitions(entity) {
        // copy config key definitions set on this entity into the miscData aggregated view
        let allConfig = entity.miscDataOrDefault('configMap', {});
        entity.config.forEach((value, key) => {
            entity.addConfigKeyDefinition(key, false, true);
        });
        entity.addConfigKeyDefinition(null, false, false);
    }

    function addUnlistedParameterDefinitions(entity) {
        // copy parameter definitions set on this entity into the miscData aggregated view;
        // see discussions in PR 112 about whether this is necessary and/or there is a better way; but note, this is much updated since
        entity.parameters.forEach((param) => {
            entity.addParameterDefinition(param, false, true);
        });
        entity.addParameterDefinition(null, false, false);
    }

    function populateEntityFromApiSuccess(entity, data) {
        function mapped(list, field) {
            let result = {};
            if (list) {
                list.forEach(l => {
                    if (l && l[field]) {
                        result[l[field]] = l;
                    }
                });
            }
            return result;
        }
        entity.clearIssues({group: 'type'});
        entity.type = data.symbolicName;
        entity.icon = data.iconUrl || iconGenerator(data.symbolicName);
        entity.miscData.set('important', !!data.iconUrl);
        entity.miscData.set('bundle', {
            symbolicName: data.containingBundle.split(':')[0],
            version: data.containingBundle.split(':')[1]
        });
        entity.miscData.set('typeName', data.displayName || data.symbolicName);
        entity.miscData.set('displayName', data.displayName);
        entity.miscData.set('symbolicName', data.symbolicName);
        entity.miscData.set('description', data.description);

        entity.miscData.set('config', data.config || []);
        entity.miscData.set('configMap', mapped(data.config, 'name'));
        entity.miscData.set('parameters', data.parameters || []);
        entity.miscData.set('parametersMap', mapped(data.parameters, 'name'));

        entity.miscData.set('sensors', data.sensors || []);
        entity.miscData.set('traits', data.supertypes || []);
        entity.miscData.set('tags', data.tags || []);
        data.tags.forEach( (t) => {
            mergeAppendingLists(COMMON_HINTS, t['ui-composer-hints']);
        });
        entity.miscData.set('ui-composer-hints', COMMON_HINTS);
        entity.miscData.set('virtual', data.virtual || null);
        addUnlistedConfigKeysDefinitions(entity);
        addUnlistedParameterDefinitions(entity);
        return entity;
    }
    function mergeAppendingLists(dst, src) {
        for (let p in src) {
            if (Array.isArray(dst[p]) || Array.isArray(src[p])) {
                dst[p] = [].concat(dst[p] || [], src[p]);
            } else {
                dst[p] = Object.assign({}, dst[p], src[p]);
            }
        }
        return dst;
    }

    function populateEntityFromApiError(entity, error) {
        $log.warn("Error loading/populating type, data will be incomplete.", entity, error);
        entity.clearIssues({group: 'type'});
        entity.addIssue(Issue.builder().group('type').message($sce.trustAsHtml(`Type <samp>${entity.type + (entity.hasVersion ? ':' + entity.version : '')}</samp> does not exist`)).build());
        entity.miscData.set('typeName', entity.type || '');
        entity.miscData.set('config', []);
        entity.miscData.set('parameters', []);
        entity.miscData.set('sensors', []);
        entity.miscData.set('traits', []);
        entity.miscData.set('virtual', null);
        entity.icon = typeNotFoundIcon;
        addUnlistedConfigKeysDefinitions(entity);
        addUnlistedParameterDefinitions(entity);
        return entity;
    }

    function populateLocationFromApiCommon(entity, data) {
        entity.clearIssues({group: 'location'});
        entity.location = data.yamlHere || data.symbolicName;

        let name = data.name || data.displayName;
        if (!name && data.yamlHere) {
            name = typeof data.yamlHere === 'object' ? Object.keys(data.yamlHere)[0] : data.yamlHere;
        }
        if (!name) name =  data.symbolicName;
        entity.miscData.set('locationName', name);

        // use icon on item, but if none then generate using *yaml* to distinguish when someone has changed it
        // (especially for things like jclouds:aws-ec2 -- the config is more interesting than the type name)
        entity.miscData.set('locationIcon', data==null ? null : data.iconUrl || iconGenerator(data.yamlHere ? JSON.stringify(data.yamlHere) : data.symbolicName));
        return entity;
    }

    function populateLocationFromApiSuccess(entity, data) {
        populateLocationFromApiCommon(entity, data);
    }

    function populateLocationFromApiError(entity) {
        populateLocationFromApiCommon(entity, { yamlHere: entity.location });
        entity.addIssue(Issue.builder().level(ISSUE_LEVEL.WARN).group('location').message($sce.trustAsHtml(`Location <samp>${!(entity.location instanceof String) ? JSON.stringify(entity.location) : entity.location}</samp> does not exist in your local catalog. Deployment might fail.`)).build());
        entity.miscData.set('locationIcon', typeNotFoundIcon);
        return entity;
    }

    /**
     * Adds {Entity} relationships provider to discover relationships between entities that are specific to provider.
     *
     * @param {String} providerName The relationships provider name.
     * @param {Object} entityRelationshipsProvider The {Entity} relationships provider. The provider must implement the
     * method `apply({Entity})` which takes {Entity} as an argument and returns array of relationships found in the
     * format [{source: {Entity}, target: {Entity}}], or an empty array [].
     */
    function addEntityRelationshipsProvider(providerName, entityRelationshipsProvider) {
        if (typeof entityRelationshipsProvider.apply !== 'function' || !providerName) {
            console.error(`Provider ${entityRelationshipsProvider} with name ${providerName} is not an Entity relationships provider.`);
        }
        entityRelationshipProviders[providerName] = entityRelationshipsProvider;
    }

    /**
     * Retrieves all the Entities referenced by an Entity.
     *
     * @param {Entity} entity the Entity to resolve relative references from
     * @return {Array} of objects that contains source and target entities
     */
    function getRelationships(entity = blueprint) {
        let relationships = [];

        // Aggregate relationships discovered by Entity relationships providers.
        for (let provider of Object.values(entityRelationshipProviders)) {
            relationships = relationships.concat(provider.apply(entity));
        }

        // Iterate over children and reduct.
        return entity.children.reduce((relationships, child) => {
            return relationships.concat(getRelationships(child))
        }, relationships);
    }

    function populateId(entity) {
        if (entity.id) return;

        let defaultSalterFn = (candidateId, index) => candidateId+"-"+index;
        let uniqueSuffixFn = (candidateId, root, salterFn) => {
            let matches = {};
            root.visitWithDescendants(e => {
                if (e.id && e.id.startsWith(candidateId)) {
                    matches[e.id] = true;
                }
            });
            if (!matches[candidateId]) return candidateId;
            let i=2;
            while (true) {
                let newCandidateId = (salterFn || defaultSalterFn)(candidateId, i);
                if (!matches[newCandidateId]) return newCandidateId;
                i++;
            }
        };

        entity.id = (brBrandInfo.blueprintComposerIdGenerator || blueprintComposerIdGenerator)(entity, uniqueSuffixFn);
    }

    function blueprintComposerIdGenerator(entity, uniqueSuffixFn) {
        let candidate = entity.hasName()
            ? entity.name.replace(/\W/g, '-').toLowerCase()
            : entity.type ? entity.type.replace(/\W/g, '-').toLowerCase()
                : !entity.parent ? "root"
                    : entity._id;
        return uniqueSuffixFn(
            candidate,
            entity.getApplication() /* unique throughout blueprint */,
            null /* use default salter */ );
    }

}
