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
import {Entity, EntityFamily} from "../util/model/entity.model";
import {Issue, ISSUE_LEVEL} from '../util/model/issue.model';
import {Dsl} from "../util/model/dsl.model";
import jsYaml from "js-yaml";
import typeNotFoundIcon from "../../img/icon-not-found.svg";

const TAG = 'SERVICE :: BLUEPRINT :: ';
export const RESERVED_KEYS = ['name', 'location', 'locations', 'type', 'services', 'brooklyn.config', 'brooklyn.children', 'brooklyn.enrichers', 'brooklyn.policies'];
export const DSL_ENTITY_SPEC = '$brooklyn:entitySpec';

export function blueprintServiceProvider() {
    return {
        $get: ['$log', '$q', '$sce', 'paletteApi', 'iconGenerator', 'dslService',
            function ($log, $q, $sce, paletteApi, iconGenerator, dslService) {
            return new BlueprintService($log, $q, $sce, paletteApi, iconGenerator, dslService);
        }]
    }
}

function BlueprintService($log, $q, $sce, paletteApi, iconGenerator, dslService) {
    let blueprint = new Entity();

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
        isReservedKey: isReservedKey,
        getIssues: getIssues,
        hasIssues: hasIssues,
        populateEntityFromApi: populateEntityFromApiSuccess,
        populateLocationFromApi: populateLocationFromApiSuccess,
        addConfigKeyDefinition: addConfigKeyDefinition,
        getRelationships: getRelationships,
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
        // TODO refresh the blueprint now?  see comments in yaml.state.js and on refreshBlueprint
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

    function getIssues(entity = blueprint) {
        let issues = [];

        if (entity.hasIssues()) {
            issues = issues.concat(entity.issues.map((issue)=> {
                let newIssue = Issue.builder().message(issue.message).group(issue.group).ref(issue.ref).level(issue.level).build();
                newIssue.entity = entity;
                return newIssue;
            }));
        }

        entity.policies.forEach((policy)=> {
            issues = issues.concat(getIssues(policy));
        });

        entity.enrichers.forEach((enricher)=> {
            issues = issues.concat(getIssues(enricher));
        });

        entity.children.forEach((child)=> {
            issues = issues.concat(getIssues(child));
        });

        return issues;
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
            ]);
        }).then(()=> {
            return entity;
        });
    }

    function refreshTypeMetadata(entity, family) {
        let deferred = $q.defer();

        if (entity.hasType()) {
            entity.family = family;

            let promise = entity.miscData.has('bundle')
                ? paletteApi.getBundleType(entity.miscData.get('bundle').symbolicName, entity.miscData.get('bundle').version, entity.type, entity.version)
                : paletteApi.getType(entity.type, entity.version);

            promise.then((data)=> {
                deferred.resolve(populateEntityFromApiSuccess(entity, data));
            }).catch(function (error) {
                deferred.resolve(populateEntityFromApiError(entity, error));
            });
        } else if (entity.parent) {
            entity.clearIssues({group: 'type'}).addIssue(Issue.builder().group('type').message('Entity needs a type').level(ISSUE_LEVEL.WARN).build());
            entity.miscData.set('sensors', []);
            entity.miscData.set('traits', []);
            deferred.resolve(entity);
            addUnlistedConfigKeysDefinitions(entity);
        } else {
            entity.miscData.set('sensors', []);
            entity.miscData.set('traits', []);
            deferred.resolve(entity);
            addUnlistedConfigKeysDefinitions(entity);
        }

        return deferred.promise;
    }

    function refreshLocationMetadata(entity) {
        let deferred = $q.defer();

        if (entity.hasLocation()) {
            paletteApi.getLocation(entity.location).then((location)=> {
                deferred.resolve(populateLocationFromApiSuccess(entity, location.catalog || location));
            }).catch(function () {
                deferred.resolve(populateLocationFromApiError(entity));
            });
        } else {
            deferred.resolve(entity);
        }

        return deferred.promise;
    }

    function refreshConfigConstraints(entity) {
        return $q((resolve) => {
            if (entity.miscData.has('config')) {
                entity.miscData.get('config')
                    .filter(config => config.constraints && config.constraints.length > 0)
                    .forEach(config => {
                        for (let constraintO of config.constraints) {
                            let message = null;
                            let key = null, args = null;
                            if (constraintO instanceof String) {
                                key = constraintO;
                            } else if (Object.keys(constraintO).length==1) {
                                key = Object.keys(constraintO)[0];
                                args = constraintO[key];
                            } else {
                                $log.warn("Unknown constraint object", constraintO);
                                key = constraintO;
                            }
                            let val = (k) => entity.config.get(k || config.name);
                            let isSet = (k) => entity.config.has(k || config.name) && angular.isDefined(val(k));
                            let hasDefault = () => angular.isDefined(config.defaultValue);
                            switch (key) {
                                case 'Predicates.notNull()':
                                case 'required':
                                    if (!isSet() && !hasDefault() && val()!='') {
                                        // "required" also means that it must not be the empty string
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
                                        message = `<samp>${config.name}</samp> cannot be set when <samp>${args}</samp> is set`;
                                    }
                                    break;
                                case 'forbiddenUnless':
                                    if (isSet() && !isSet(args)) {
                                        message = `<samp>${config.name}</samp> cannot be set unless <samp>${args}</samp> is set`;
                                    }
                                    break;
                                case 'requiredIf':
                                    if (!isSet() && isSet(args)) {
                                        message = `<samp>${config.name}</samp> is required when <samp>${args}</samp> is set`;
                                    }
                                    break;
                                case 'requiredUnless':
                                    if (!isSet() && !isSet(args)) {
                                        message = `<samp>${config.name}</samp> is required when <samp>${args}</samp> is not set`;
                                    }
                                    break;
                            }
                            if (message !== null) {
                                entity.addIssue(Issue.builder().group('config').ref(config.name).message($sce.trustAsHtml(message)).build());
                            }
                        }
                    });
            }
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
                $log.debug(ex);
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
                entity.clearIssues({ref: result.key});
                result.issues.forEach(issue => {
                    entity.addIssue(Issue.builder().group('config').ref(result.key).message($sce.trustAsHtml(issue)).build());
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

    function addConfigKeyDefinition(config, key) {
        config.push({
            "constraints": [],
            "description": "",
            "name": key,
            "label": key,
            "priority": 1,
            "pinned": true,
            "type": "java.lang.String",
        });
    }

    function addUnlistedConfigKeysDefinitions(entity) {
        let allConfig = entity.miscData.get('config') || [];
        entity.config.forEach((value, key) => {
            if (!allConfig.some((e) => e.name === key)) {
                addConfigKeyDefinition(allConfig, key);
            }
        });
        entity.miscData.set('config', allConfig);
    }

    function populateEntityFromApiSuccess(entity, data) {
        entity.clearIssues({group: 'type'});
        entity.type = data.symbolicName;
        entity.icon = data.iconUrl || iconGenerator(data.symbolicName);
        entity.miscData.set('important', !!data.iconUrl);
        entity.miscData.set('bundle', {
            symbolicName: data.containingBundle.split(':')[0],
            version: data.containingBundle.split(':')[1]
        });
        entity.miscData.set('typeName', data.displayName || data.symbolicName);
        entity.miscData.set('config', data.config || []);
        entity.miscData.set('sensors', data.sensors || []);
        entity.miscData.set('traits', data.supertypes || []);
        entity.miscData.set('tags', data.tags || []);
        var uiHints = {};
        data.tags.forEach( (t) => { 
            mergeAppendingLists(uiHints, t['ui-composer-hints']);
        });
        entity.miscData.set('ui-composer-hints', uiHints);
        entity.miscData.set('virtual', data.virtual || null);
        addUnlistedConfigKeysDefinitions(entity);
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
        entity.miscData.set('sensors', []);
        entity.miscData.set('traits', []);
        entity.miscData.set('virtual', null);
        entity.icon = typeNotFoundIcon;
        addUnlistedConfigKeysDefinitions(entity);
        return entity;
    }

    function populateLocationFromApiSuccess(entity, data) {
        entity.clearIssues({group: 'location'});
        entity.location = data.symbolicName;
        entity.miscData.set('locationName', data.name);
        entity.miscData.set('locationIcon', data.iconUrl || iconGenerator(data.symbolicName));
        return entity;
    }

    function populateLocationFromApiError(entity) {
        entity.clearIssues({group: 'location'});
        entity.addIssue(Issue.builder().level(ISSUE_LEVEL.WARN).group('location').message($sce.trustAsHtml(`Location <samp>${!(entity.location instanceof String) ? JSON.stringify(entity.location) : entity.location}</samp> does not exist in your local catalog. Deployment might fail.`)).build());
        entity.miscData.set('locationName', entity.location);
        entity.miscData.set('locationIcon', typeNotFoundIcon);
        return entity;
    }

    /**
     * Retrieves all the Entities referenced by an Entity
     * @param {Entity} entity the Entity to resolve relative references from
     * @return {Array} of objects that contains source and target entities
     */
    function getRelationships(entity = blueprint) {
        let set = Array.from(entity.config.values())
            .reduce((set, config)=> {
                if (config instanceof Dsl) {
                    config.relationships.forEach((entity) => {
                        if (entity !== null) {
                            set.add(entity);
                        }
                    });
                }
                if (config instanceof Array) {
                    config
                        .filter(conf => conf instanceof Dsl)
                        .reduce((set, config)=> {
                            config.relationships.forEach((entity)=> {
                                if (entity !== null) {
                                    set.add(entity);
                                }
                            });
                            return set;
                        }, set);
                }
                if (config instanceof Object) {
                    Object.keys(config)
                        .filter(key => config[key] instanceof Dsl)
                        .reduce((set, key)=> {
                            config[key].relationships.forEach((entity)=> {
                                if (entity !== null) {
                                    set.add(entity);
                                }
                            });
                            return set;
                        }, set);
                }
                return set;
            }, new Set());

        let relationships = Array.from(set).map((relation) => {
            return {
                source: entity,
                target: relation
            };
        });

        return entity.children.reduce((relationships, child) => {
            return relationships.concat(getRelationships(child))
        }, relationships);
    }

}
