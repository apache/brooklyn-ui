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
import {Entity, EntityFamily} from "./entity.model";
import {Issue} from './issue.model';

const DOT_MEMBERSPEC_REGEX = /^(\w+\.)*member[sS]pec$/;
export const PREDICATE_DOT_MEMBERSPEC = (config, entity)=>(config.name.match(DOT_MEMBERSPEC_REGEX));

const FIRST_MEMBERSPEC_REGEX = /^(\w+\.)*first[mM]ember[sS]pec$/;
export const PREDICATE_FIRST_MEMBERSPEC = (config, entity)=>(config.name.match(FIRST_MEMBERSPEC_REGEX));


describe('Brooklyn Model', ()=> {

    describe('Entity', ()=> {
        it('should initialize correctly', ()=> {
            let entity = new Entity();
            expect(entity._id).not.toBeNull();
            expect(entity.hasParent()).toBe(false);
            expect(entity.hasName()).toBe(false);
            expect(entity.hasType()).toBe(false);
            expect(entity.hasVersion()).toBe(false);
            expect(entity.hasChildren()).toBe(false);
            expect(entity.hasConfig()).toBe(false);
            expect(entity.hasLocation()).toBe(false);
            expect(entity.hasInheritedLocation()).toBe(false);
            expect(entity.hasEnrichers()).toBe(false);
            expect(entity.hasPolicies()).toBe(false);
            expect(entity.hasIssues()).toBe(false);
            expect(entity.hasInitializers()).toBe(false);
        });

        it('should load metadata from JSON', ()=> {
            let entity = new Entity();
            entity.setEntityFromJson(CONFIG_OBJECT);
            let data = entity.getData();
            expect(data).not.toBeNull();
            expect(Object.keys(data)).toEqual(Object.keys(CONFIG_OBJECT));
        });

        it('should fail to load catalog.bom JSON', ()=> {
            let entity = new Entity();
            expect(()=>(entity.setEntityFromJson({'brooklyn.catalog': {}})))
                .toThrowError('Catalog format not supported ... unsupported field [brooklyn.catalog]');
            expect(()=>(entity.setEntityFromJson({'item': {}})))
                .toThrowError('Catalog format not supported ... unsupported field [item]');
            expect(()=>(entity.setEntityFromJson({'items': {}})))
                .toThrowError('Catalog format not supported ... unsupported field [items]');
        });

        it('should fail to load an invalid JSON type', ()=> {
            let msgPattern = /^Entity cannot be set from \[([A-Za-z]*)] ... please supply an \[Object]$/;
            let entity = new Entity();
            expect(()=>(entity.setEntityFromJson('string')))
                .toThrowError(msgPattern);
            expect(()=>(entity.setEntityFromJson(['array'])))
                .toThrowError(msgPattern);
            expect(()=>(entity.setEntityFromJson(true)))
                .toThrowError(msgPattern);
            expect(()=>(entity.setEntityFromJson(12345)))
                .toThrowError(msgPattern);
        });

        it('should load brooklyn.initializers from JSON', ()=> {
            let entity = new Entity();
            entity.setInitializersFromJson([INITIALIZER_OBJECT]);
            let data = entity.getData();
            expect(data).not.toBeNull();
            expect(Object.keys(data)).toContain('brooklyn.initializers');
            expect(Object.keys(data['brooklyn.initializers'])).toEqual(Object.keys([INITIALIZER_OBJECT]));
        });

        it('should fail to load an invalid brooklyn.initializers', ()=> {
            let errorMessage = 'Model parse error ... cannot add initializers as it must be an array';
            let entity = new Entity();
            expect(()=>(entity.setInitializersFromJson('string')))
                .toThrowError(errorMessage);
            expect(()=>(entity.setInitializersFromJson(true)))
                .toThrowError(errorMessage);
            expect(()=>(entity.setInitializersFromJson(12345)))
                .toThrowError(errorMessage);
            expect(()=>(entity.setInitializersFromJson(undefined)))
                .toThrowError(errorMessage);
            expect(()=>(entity.setInitializersFromJson(null)))
                .toThrowError(errorMessage);
        });

        it('should load brooklyn.config from JSON', ()=> {
            let entity = new Entity();
            entity.setConfigFromJson(CONFIG_OBJECT);
            let data = entity.getData();
            expect(data).not.toBeNull();
            expect(Object.keys(data)).toContain('brooklyn.config');
            expect(Object.keys(data['brooklyn.config'])).toEqual(Object.keys(CONFIG_OBJECT));
        });

        it('should load blueprint from JSON', ()=> {
            let entity = new Entity();
            entity.setEntityFromJson(BLUEPRINT_OBJECT);
            let data = entity.getData();
            expect(data).not.toBeNull();
            expect(Object.keys(data)).toEqual(Object.keys(BLUEPRINT_OBJECT));
            expect(entity.location).toEqual(BLUEPRINT_OBJECT.location);
            expect(data.services.length).toBe(BLUEPRINT_OBJECT.services.length);
            expect(Object.keys(data.services[0])).toEqual(Object.keys(BLUEPRINT_OBJECT.services[0]));
            expect(data.services[0]['brooklyn.children'].length)
                .toBe(BLUEPRINT_OBJECT.services[0]['brooklyn.children'].length);
            expect(data.services[0]['brooklyn.children'][0].type)
                .toBe(BLUEPRINT_OBJECT.services[0]['brooklyn.children'][0].type);
            expect(data.services[0]['brooklyn.policies'].length)
                .toBe(BLUEPRINT_OBJECT.services[0]['brooklyn.policies'].length);
            expect(data.services[0]['brooklyn.policies'][0].type)
                .toBe(BLUEPRINT_OBJECT.services[0]['brooklyn.policies'][0].type);
            expect(data.services[0]['brooklyn.enrichers'].length)
                .toBe(BLUEPRINT_OBJECT.services[0]['brooklyn.enrichers'].length);
            expect(data.services[0]['brooklyn.enrichers'][0].type)
                .toBe(BLUEPRINT_OBJECT.services[0]['brooklyn.enrichers'][0].type);
        });

        it('should be a "clustered" entity if it has "cluster" or "group" traits', ()=> {
            let entity = new Entity();
            expect(entity.isCluster()).toBe(false);
            entity.miscData.set('traits', ['com.example.MyChildType0']);
            expect(entity.isCluster()).toBe(false);
            entity.miscData.set('traits', ['com.example.MyChildType0', 'org.apache.brooklyn.entity.group.Cluster']);
            expect(entity.isCluster()).toBe(true);
            entity.miscData.set('traits', ['com.example.MyChildType0', 'org.apache.brooklyn.entity.group.Fabric']);
            expect(entity.isCluster()).toBe(true);
        });
        it('should retrieve the cluster memberspec entities', ()=> {
            let entity = new Entity();
            entity.setEntityFromJson(BLUEPRINT_OBJECT);
            entity.children[1].miscData.set('traits', TRAITS_CLUSTER);
            entity.children[1].miscData.set('config', AVAILABLE_CONFIG);
            expect(entity.children.length).toBe(BLUEPRINT_OBJECT.services.length);
            expect(entity.children[1].isCluster()).toBe(true);
            let memberSpecs = Object.values(entity.children[1].getClusterMemberspecEntities());
            expect(memberSpecs).toBeDefined();
            expect(memberSpecs.length).toBe(2);
            expect(memberSpecs[0].family).toBe(EntityFamily.SPEC);
            expect(memberSpecs[1].family).toBe(EntityFamily.SPEC);
            let configKeys = Object.keys(entity.children[1].getClusterMemberspecEntities());
            expect(configKeys).toBeDefined();
            expect(configKeys.length).toBe(2);
            const msi = configKeys.findIndex(ck => ck=='cluster.memberspec');
            const fmsi = configKeys.findIndex(ck => ck=='cluster.firstMemberspec');
            expect(msi).not.toBe(-1);
            expect(fmsi).not.toBe(-1);
            expect(entity.children[1].getClusterMemberspecEntity((config, entity)=>(entity._id === memberSpecs[0]._id))).toBe(memberSpecs[0]);
            expect(entity.children[1].getClusterMemberspecEntity((config, entity)=>(entity._id === memberSpecs[1]._id))).toBe(memberSpecs[1]);
            expect(entity.children[1].getClusterMemberspecEntity(PREDICATE_DOT_MEMBERSPEC)).toBe(memberSpecs[msi]);
            expect(entity.children[1].getClusterMemberspecEntity(PREDICATE_FIRST_MEMBERSPEC)).toBe(memberSpecs[fmsi]);
        });

        // Location
        it('should have an inherited location', ()=> {
            let entity = new Entity();
            entity.setEntityFromJson(BLUEPRINT_OBJECT);
            if (entity.hasChildren()) {
                checkInheritedLocation(entity, entity.location);
            }

            function checkInheritedLocation(entity, location) {
                entity.children.forEach((child)=> {
                    expect(child.hasInheritedLocation()).toBeTruthy();
                    expect(child.getInheritedLocation()).toBe(location);
                    expect(child.getInheritedLocation()).toBe(BLUEPRINT_OBJECT.location);
                    if (child.hasChildren()) {
                        checkInheritedLocation(child, location);
                    }
                });
            }
        });

        // Policies
        it('should not add a policy if not an Entity', ()=> {
            let addPolicy = ()=> {
                let entity = new Entity();
                let policy = new Object();
                entity.addPolicy(policy);
            };

            expect(addPolicy).toThrowError('Cannot add policy ... policy must be of type policy');
        });
        it('should be able to add a empty new policy', ()=> {
            let entity = new Entity();
            entity.addNewPolicy();
            expect(entity.policies).not.toBeNull();
            expect(entity.getPoliciesAsArray().length).toBe(1);
        });
        it('should add a policy', ()=> {
            let entity = new Entity();
            let policy = new Entity();
            entity.addPolicy(policy);
            expect(entity.policies).not.toBeNull();
            expect(entity.getPoliciesAsArray().length).toBe(1);
            expect(entity.policies.get(policy._id)).toBe(policy);
        });
        it('should remove a policy', ()=> {
            let entity = new Entity();
            let policy1 = new Entity();
            let policy2 = new Entity();
            entity.addPolicy(policy1);
            entity.addPolicy(policy2);
            expect(entity.policies).not.toBeNull();
            expect(entity.getPoliciesAsArray().length).toBe(2);
            entity.removePolicy(policy1._id);
            expect(entity.getPoliciesAsArray().length).toBe(1);
            expect(entity.policies.get(policy2._id)).toBe(policy2)
        });
        it('should have the correct family', ()=> {
            let entity = new Entity();
            let unknownEntity1 = new Entity();
            let unknownEntity2 = new Entity();
            let unknownEntity3 = new Entity();
            let policy = entity.addNewPolicy();
            let enricher = entity.addNewEnricher();

            expect(entity.family).toBe(EntityFamily.ENTITY);
            expect(unknownEntity1.family).toBe(EntityFamily.ENTITY);
            expect(unknownEntity2.family).toBe(EntityFamily.ENTITY);
            expect(unknownEntity3.family).toBe(EntityFamily.ENTITY);
            expect(policy.family).toBe(EntityFamily.POLICY);
            expect(enricher.family).toBe(EntityFamily.ENRICHER);

            entity.addPolicy(unknownEntity1);
            entity.addEnricher(unknownEntity2);
            unknownEntity3.family = 'My totally made up family';

            expect(unknownEntity1.family).toBe(EntityFamily.POLICY);
            expect(unknownEntity2.family).toBe(EntityFamily.ENRICHER);
            expect(unknownEntity3.family).toBe(EntityFamily.ENTITY);
        });
        it('should be able to add issues', ()=> {
            let entity = new Entity();
            entity.addIssue(new Issue());

            expect(entity.issues).toBeDefined();
            expect(entity.issues.length).toBe(1);
        });
        it('should be able to reset all issues', ()=> {
            let entity = new Entity();
            entity.addIssue(new Issue());
            entity.addIssue(new Issue());
            entity.addIssue(new Issue());

            expect(entity.issues).toBeDefined();
            expect(entity.issues.length).toBe(3);

            entity.resetIssues();

            expect(entity.issues.length).toBe(0);
        });
        it('should be able to reset all issues', ()=> {
            let entity = new Entity();
            let issues = [
                Issue.builder().group('foo').message('foo').build(),
                Issue.builder().group('bar').message('bar').build(),
                Issue.builder().group('hello').ref('hello').message('hello').build(),
                Issue.builder().group('hello').ref('world').message('bar').build(),
                Issue.builder().group('hello').ref('world').message('bar').build()
            ];
            issues.forEach(issue => entity.addIssue(issue));

            expect(entity.issues).toBeDefined();
            expect(entity.issues.length).toBe(issues.length);

            entity.clearIssues({group: 'foo'});

            expect(entity.issues.length).toBe(4);
            expect(entity.issues.filter(issue => issue.group === 'foo').length).toBe(0);

            entity.clearIssues({group: 'hello', ref: 'hello'});

            expect(entity.issues.length).toBe(3);
            expect(entity.issues.filter(issue => issue.group === issue.ref === 'hello').length).toBe(0);

            entity.clearIssues({group: 'hello'});

            expect(entity.issues.length).toBe(1);
            expect(entity.issues.filter(issue => issue.group === 'hello').length).toBe(0);
        });
    });
});

const TRAITS_CLUSTER = [
    'org.apache.brooklyn.entity.group.Cluster'
];
const AVAILABLE_CONFIG = [{
        constraints: [],
        description: "entity spec for creating new cluster members",
        label: "cluster.memberspec",
        name: "cluster.memberspec",
        pinned: false,
        reconfigurable: false,
        type: "org.apache.brooklyn.api.entity.EntitySpec",
    }, {
        constraints: [],
        description: "entity spec for creating first cluster member",
        label: "cluster.firstMemberspec",
        name: "cluster.firstMemberspec",
        pinned: false,
        reconfigurable: false,
        type: "org.apache.brooklyn.api.entity.EntitySpec",
    }
];

const CONFIG_OBJECT = {
    textKey: 'textValue',
    boolKey: false,
    numKey: 123456789,
    nullKey: null,
    objectKey: {
        key: 'val',
    }
};

const INITIALIZER_OBJECT = {
    type: 'brooklyn.special.application',
    boolKey: false,
    numKey: 123456789,
    nullKey: null,
    objectKey: {
        key: 'val',
    }
};

const BLUEPRINT_OBJECT = {
    name: 'Blueprint Name',
    version: '1.0',
    location: 'my-named-location',
    services: [
        {
            type: 'com.example.MyType',
            'brooklyn.config': CONFIG_OBJECT,
            'brooklyn.children': [
                {
                    type: 'com.example.MyChildType1',
                    'brooklyn.config': CONFIG_OBJECT
                }, {
                    type: 'com.example.MyChildType2',
                    'brooklyn.config': CONFIG_OBJECT
                }
            ],
            'brooklyn.policies': [
                {
                    type: 'com.example.MyPolicy',
                    'brooklyn.config': CONFIG_OBJECT
                }
            ],
            'brooklyn.enrichers': [
                {
                    type: 'com.example.MyEnricher',
                    'brooklyn.config': CONFIG_OBJECT
                }
            ]
        }, {
            type: 'com.example.ClusterType',
            'brooklyn.config': {
                'cluster.firstMemberspec': {
                    '$brooklyn:entitySpec': {
                        type: 'com.example.first.ClusterMember',
                        'brooklyn.config': CONFIG_OBJECT
                    }
                },
                'cluster.memberspec': {
                    '$brooklyn:entitySpec': {
                        type: 'com.example.ClusterMember',
                        'brooklyn.config': CONFIG_OBJECT
                    }
                }
            }
        }
    ]
};
