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
import {Entity} from './entity.model';

const FUNCTION_PREFIX = '$brooklyn:';

export const TARGET = {
    SELF: 'self',
    ROOT: 'root',
    CHILD: 'child',
    ENTITY: 'entity',
    PARENT: 'parent',
    SIBLING: 'sibling',
    ANCESTOR: 'ancestor',
    SCOPEROOT: 'scopeRoot',
    COMPONENT: 'component',
    DESCENDANT: 'descendant'
}

const TARGETS = Object.values(TARGET);

const UTILITIES = [ 'literal', 'formatString', 'urlEncode', 'regexReplacement' ];

export const FAMILY = {
    CONSTANT: 'constant',
    FUNCTION: 'function',
    REFERENCE: 'reference',
};

export const KIND = {
    UTILITY : {family: FAMILY.FUNCTION,  name: 'utility function'},
    TARGET  : {family: FAMILY.FUNCTION,  name: 'target entity function'},
    METHOD  : {family: FAMILY.FUNCTION,  name: 'method'},
    ENTITY  : {family: FAMILY.REFERENCE, name: 'entity object'},
    STRING  : {family: FAMILY.CONSTANT,  name: 'constant string'},
    NUMBER  : {family: FAMILY.CONSTANT,  name: 'constant number'},
    OTHER   : {family: FAMILY.CONSTANT,  name: 'constant other'},
    PORT    : {family: FAMILY.CONSTANT,  name: 'constant port'},
};

const ID = new WeakMap();
const PREV = new WeakMap();
const NEXT = new WeakMap();
const PARENT = new WeakMap();
const PARAMS = new WeakMap();
const KINDS = new WeakMap();
const REF = new WeakMap();
const NAME = new WeakMap();
const RELATIONSHIPS = new WeakMap();
const ISSUES = new WeakMap();

const numberRegex = /^[+-]?\d+(?:\.\d*)?|^[+-]?\.\d+/;

const portRangeRegex = /[\d]+\+|[\d]+-[\d]+/;

/**
 * A component of a Dsl expression.
 * This class can represent a constant (e.g., a string or number),
 * an Entity object, or a function call with parameters.
 * Dsl expression are composable, e.g. function parameters are also Dsl expressions.
 * Function calls can also be chained to other function calls.
 */
export class Dsl {
    /**
     * @param kind
     * @param {string} name
     * @param {Entity} entity
     */
    constructor(kind = KIND.STRING, name, entity) {
        ID.set(this, Math.random().toString(36).slice(2));
        PARAMS.set(this, new Array());
        KINDS.set(this, kind);
        NAME.set(this, name === undefined ? ID.get(this).toString() : name.toString());
        RELATIONSHIPS.set(this, new Array());
        ISSUES.set(this, new Array());
    }

    /**
     * The internal entity id
     * @returns {string}
     */
    get _id() {
        return ID.get(this);
    }

    /**
     * Get {Dsl} name
     * @returns {string}
     */
    get name() {
        return NAME.get(this);
    }

    /**
     * Set {Dsl} name
     * @param {string} name
     */
    set name(name) {
        if (name instanceof String || typeof name === 'string') {
            NAME.set(this, name.toString());
        } else {
            throw new DslError('Cannot set name ... name must be a string: ' + typeof name);
        }
    }

    /**
     * Set Entity reference
     * @param {Entity} entity
     */
    set ref(entity) {
        if (entity instanceof Entity) {
            REF.set(this, entity);
            this.kind = KIND.ENTITY;
        } else {
            throw new DslError('Cannot set ref ... ref must be of type Entity');
        }
    }

    /**
     * Get Entity reference
     * @return {Entity}
     */
    get ref() {
        return REF.get(this);
    }

    /**
     * Get {Dsl} parent
     * @returns {Dsl}
     */
    get parent() {
        return PARENT.get(this);
    }

    /**
     * Set {Dsl} parent
     * @param {Dsl} parent
     */
    set parent(parent) {
        if (parent instanceof Dsl) {
            if (PARENT.get(this) !== parent) {
                PARENT.set(this, parent);
            }
        } else {
            throw new DslError('Cannot add parent ... parent must be of type Dsl');
        }
    }

    /**
     * Get {Dsl} prev
     * @returns {Dsl}
     */
    get prev() {
        return PREV.get(this);
    }

    /**
     * Set {Dsl} prev
     * @param {Dsl} prev
     */
    set prev(prev) {
        if (prev instanceof Dsl) {
            if (PREV.get(this) !== prev) {
                PREV.set(this, prev);
            }
        } else {
            throw new DslError('Cannot set prev ... prev must be of type Dsl');
        }
    }

    /**
     * Get {Dsl} next
     * @returns {Dsl}
     */
    get next() {
        return NEXT.get(this);
    }

    /**
     * Set {Dsl} next
     * @param {Dsl} next
     */
    set next(next) {
        if (next instanceof Dsl) {
            if (NEXT.get(this) !== next) {
                NEXT.set(this, next);
            }
        } else {
            throw new DslError('Cannot set next ... next must be of type Dsl');
        }
    }

    /**
     * Get parameters
     * @return {Array}
     */
    get params() {
        return PARAMS.get(this);
    }

    /**
     * Get kind
     * @return
     */
    get kind() {
        return KINDS.get(this);
    }

    /**
     * Set kind
     * @param kind
     */
    set kind(kind) {
        if (Object.values(KIND).includes(kind)) {
            KINDS.set(this, kind);
        }
        else {
            throw new DslError('Cannot set kind ... not a valid KIND');
        }
    }

    /**
     * Get relationships
     * @return {Array} an array of Entities
     */
    get relationships() {
        return RELATIONSHIPS.get(this);
    }

    /**
     * Set relationships
     * @param {Array} relationships an array of Entities
     */
    set relationships(relationships) {
        RELATIONSHIPS.set(this, relationships);
    }

    /**
     * Get issues
     * @return {Array}
     */
    get issues() {
        return ISSUES.get(this);
    }

    /**
     * Set issues
     * @param {Array} issues
     */
    set issues(issues) {
        ISSUES.set(this, issues);
    }

    /**
     * Push param {Dsl}
     * @param {Dsl} param
     * @returns {Dsl}
     */
    param(param) {
        if (param instanceof Dsl) {
            if (this.kind.family !== FAMILY.FUNCTION) {
                throw new DslError('Cannot push param to non-function... Dsl kind is: ' + this.kind.name);
            }
            PARAMS.get(this).push(param);
            param.parent = this;
            return this;
        } else {
            throw new DslError('Cannot push param ... param must be of type Dsl');
        }
    }

    /**
     * Pop param
     * @param {string} id
     * @returns {Dsl}
     */
    popParam() {
        if (this.hasParams()) {
            let dsl = PARAMS.get(this).pop();
            PARENT.delete(dsl);
        }
        return this;
    }

    /**
     * Has {Dsl} got params
     * @returns {boolean}
     */
    hasParams() {
        return PARAMS.get(this).length > 0;
    }

    /**
     * Has {Dsl} got a name
     * @return {boolean}
     */
    hasName() {
        return NAME.has(this);
    }

    /**
     * Has {Dsl} got a parent
     * @returns {boolean}
     */
    hasParent() {
        return PARENT.has(this);
    }

    /**
     * Has {Dsl} got a next
     * @returns {boolean}
     */
    hasNext() {
        return NEXT.has(this);
    }

    /**
     * Has {Dsl} got a prev
     * @returns {boolean}
     */
    hasPrev() {
        return PREV.has(this);
    }

    /**
     * Has {Dsl} got a ref
     * @return {boolean}
     */
    hasRef() {
        return REF.has(this);
    }

    /**
     * Has {Dsl} got issues
     * @return {boolean}
     */
    hasIssues() {
        return this.issues.length > 0;
    }

    /**
     * Retrieves the Dsl for the last chained call
     * @return {Dsl}
     */
    getLastMethod() {
        if (this.next) {
            return this.next.getLastMethod();
        }
        else {
            return this;
        }
    }

    /**
     * Chain a function call to this Dsl
     * @param method
     * @return {Dsl}
     */
    chain(method) {
        if (method instanceof Dsl) {
            if (method.kind.family !== FAMILY.FUNCTION) {
                throw new DslError('Cannot push method ... method must be a function');
            }
            let last = this.getLastMethod();
            last.next = method;
            method.prev = last;
            return method;
        } else {
            throw new DslError('Cannot push method ... method must be of type Dsl');
        }
    }

    /**
     * Remove the last chained call from this Dsl
     * @return {Dsl}
     */
    popChainedMethod() {
        let last = this.getLastMethod();
        if (last.hasPrev()) {
            NEXT.delete(last.prev);
            PREV.delete(last);
        }
        return this;
    }

    /**
     * Get the root node for this Dsl
     * @return {Dsl}
     */
    getRoot() {
        if (this.hasParent()) {
            return this.parent.getRoot();
        }
        else if (this.hasPrev()) {
            return this.prev.getRoot();
        }
        else return this;
    }

    /**
     * Equality comparison
     * @param value
     * @return {boolean}
     */
    equals(value) {
        if (value && value instanceof Dsl) {
            try {
                if (this.kind === value.kind) {
                    return this.toString() === value.toString();
                }
            } catch (err) {
            }
        }
        return false;
    }

    /**
     * Return the DSL representation for this Dsl
     * @return {string}
     */
    toString() {
        let current = this;
        let yaml = current.generate();
        switch (current.kind.family) {
            case FAMILY.FUNCTION:
                yaml = FUNCTION_PREFIX + yaml;
                // fallthrough to next case
            case FAMILY.REFERENCE:
                while (current.hasNext()) {
                    current = current.next;
                    yaml += '.' + current.generate();
                }
                break;
            default:
                // TODO check if we need unquoted string constants (they're in quotes now)
        }
        return yaml;
    }
    
    toJSON() {
        // note the result of this is serialized, as per JSON.stringify docs for an Object.toJSON:
        // (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
        // semantics of this method are toReplacedObjectForJsonSerialization _not_ toEncodedJsonString;
        // so we want the toString
        return this.toString();
    }

    /**
     * Return a clone for this Dsl
     * @return {Dsl}
     */
    clone() {
        let clone = new Dsl(this.kind, this.name);
        clone.relationships = Array.from(this.relationships);
        clone.issues = Array.from(this.issues);
        if (this.next) {
            clone.next = this.next.clone();
        }
        this.params.forEach(param => clone.param(param.clone()));

        return clone;
    }

    /**
     * Return the DSL representation for this Dsl component (only)
     * @return {string}
     */
    generate() {
        if (this.kind.family === FAMILY.FUNCTION) {
            return this.name + '(' + this.generateParams() + ')';
        }
        else if (this.kind === KIND.ENTITY) {
            return 'entity("' + this.ref.id + '")';
        }
        else if (this.kind === KIND.STRING) {
            return JSON.stringify(this.name);
        }
        else if (this.kind === KIND.PORT) {
            // In case we get a single port range (i.e. 8080+, not part of a $brooklyn:...)
            // we need to return the value without double quote, otherwise, Brooklyn won't accept it.
            return this.hasParent() || this.hasNext() || this.hasPrev() ? JSON.stringify(this.name) : this.name;
        }
        return this.name;
    }

    /**
     * Return the DSL representation for a list of parameters, comma separated
     * @return {string}
     */
    generateParams() {
        return this.params.map(param => param.toString()).join(', ');
    }

    /**
     * Recursively visit this Dsl
     * @param func a function to call on each node in the Dsl graph
     */
    visit(func) {
        if (!this.visiting) {
            this.visiting = true;
            func(this);
            this.params.forEach(p => p.visit(func));
            if (this.hasPrev()) {
                this.prev.visit(func);
            }
            if (this.hasNext()) {
                this.next.visit(func);
            }
            this.visiting = false;
        }
    }

    /**
     * Retrieve the issues for this Dsl, recursively
     */
    getAllIssues() {
        let allIssues = new Array();

        this.visit(dsl => {
            allIssues = allIssues.concat(dsl.issues);
        });

        return allIssues;
    }

    /**
     * Retrieve the references contained in this Dsl, recursively
     * @return {Array} an array containing either Entities or other Dsls that can be resolved to Entities
     */
    getReferences() {
        let refs = new Set();

        this.visit(dsl => {
            if (dsl.kind === KIND.TARGET) {
                if (!dsl.hasPrev() || dsl.prev.kind !== KIND.ENTITY) {
                    // only add the leftmost dsl in a chain of entity functions
                    refs.add(dsl);
                }
            }
            else if (dsl.kind === KIND.ENTITY) {
                refs.add(dsl.ref);
            }
        });

        return Array.from(refs);
    }

    /**
     * Retrieve the Entities referenced by this Dsl
     * @param {Entity} entity the base Entity, used to resolve relative references
     * @param {function} entityResolver a function to resolve an entity from an ID
     * @return {Array} the Entities referenced by this Dsl
     */
    getRelationships(entity, entityResolver) {
        let references = this.getReferences();
        let entitySet = new Set();
        for (const ref of references) {
            if (ref instanceof Entity) {
                entitySet.add(ref);
            }
            else if (ref instanceof Dsl) {
                let resolvedEntity = ref.resolveEntity(entity, entityResolver);
                if (resolvedEntity && resolvedEntity !== entity) { // don't add relationships to self
                    entitySet.add(resolvedEntity);
                }
            }
            else {
                throw new Error('Invalid value type in dsl references: ' + typeof ref);
            }
        }
        return Array.from(entitySet);
    }

    /**
     * Resolve the Entity referenced by this Dsl
     * @param {Entity} entity the base entity to resolve relative targets against
     * @param {function} entityResolver a function to resolve an Entity from an ID
     * @return {Entity}
     */
    resolveEntity(entity, entityResolver) {
        let dsl = this;
        let curr = entity;
        while (dsl.kind === KIND.TARGET) {
            switch (dsl.name) {
                case TARGET.SELF:
                    break;
                case TARGET.PARENT:
                    if (!curr.parent) {
                        this.issues.push('The entity with ID <code>' + curr.id + '</code> does not have a parent');
                    }
                    curr = curr.parent;
                    break;
                case TARGET.CHILD:
                case TARGET.SIBLING:
                case TARGET.DESCENDANT:
                case TARGET.ANCESTOR:
                case TARGET.ENTITY:
                case TARGET.COMPONENT: // component can have 1 or 2 params
                    let name = dsl.params[dsl.params.length - 1].name;
                    let resolvedEntity = entityResolver(name);
                    if (resolvedEntity === null) {
                        this.issues.push('The reference ID <code>' + name + '</code> does not exist');
                    }
                    curr = resolvedEntity;
                    break;
                case TARGET.ROOT:
                case TARGET.SCOPEROOT:
                    curr = this.resolveRoot(curr);
                    break;
            }
            if (dsl.hasNext()) {
                // follow the call chain
                dsl = dsl.next;
            }
            else {
                break;
            }
        }
        return curr;
    }

    /**
     * Utility method to get the root from an Entity
     * @param {Entity} e an Entity
     * @return {Entity} the root Entity
     */
    resolveRoot(e) {
        while (e.hasParent()) {
            e = e.parent;
        }
        return e;
    }

}

function fnLookupInDescendantsById(root) {
    return id => {
        if (root.id === id) {
            return root;
        }
        for (let child of root.childrenAsMap.values()) {
            let ret = fnLookupInDescendantsById(child)(id);
            if (ret !== null) {
                return ret;
            }
        }
        return null;
    };
}

/**
 * A parser for Dsl expressions.
 */
export class DslParser {
    /**
     * @param {*} s a Dsl expression to parse, e.g. a string
     */
    constructor(s) {
        this.s = s;
    }

    /**
     * Parse this expression, or throw if it is malformed.
     * @param {Entity} entity the base Entity to resolve relative references from
     * @param {function} entityResolver a function to resolve an entity from an ID
     * @return {Dsl} the Dsl object representing this expression
     */
    parse(entity, entityResolverOrRoot) {
        if (this.s instanceof String || typeof this.s === 'string') {
            return this.parseString(this.s.toString().trim(), entity, entityResolverOrRoot);
        }
        // NUMBER and OTHER kinds are in the CONSTANT family which means they aren't DSL expressions
        // (API here could be improved!)
        if (typeof this.s === 'number') {
            return new Dsl(KIND.NUMBER, this.s)
        }
        if (typeof this.s === 'boolean') {
            return new Dsl(KIND.OTHER, this.s)
        }
        // TODO support JSON objects (when YAML syntax supplied, eg object or entitySpec)
        throw new DslError("Unable to parse: " + typeof this.s);
    }

    /**
     * Parse an expression in string form, or throw.
     * @param {string} s the expression to parse
     * @param {Entity} entity the base Entity to resolve relative references from
     * @param {function} entityResolver a function to resolve an entity from an ID
     * @return {Dsl} the Dsl object representing the expression in s
     */
    parseString(s, entity, entityResolverOrRoot) {
        const entityResolver = (typeof entityResolverOrRoot === 'function') ? entityResolverOrRoot : fnLookupInDescendantsById(entityResolverOrRoot);

        let t = new Tokenizer(s);
        let dsl = this.expression(t);
        t.skipWhitespace();
        if (!t.atEndOfInput()) {
            throw new DslError('EXPRESSION followed by spurious content: ' + t.toJSON());
        }
        if (entity && entityResolver) {
            dsl.relationships = dsl.getRelationships(entity, entityResolver);
        }
        return dsl;
    }

    /**
     * Parse a Dsl expression, or throw.
     * EXPRESSION ::= FUNCTION_CHAIN | CONSTANT
     * @param {Tokenizer} t the current Tokenizer
     * @return {Dsl} the Dsl object representing the expression
     */
    expression(t) {
        if (t.peek(FUNCTION_PREFIX)) {
            t.next(FUNCTION_PREFIX);
            return this.functionChain(t);
        }
        else {
            return this.constant(t);
        }
    }

    /**
     * Parse a Dsl function call chain, or throw.
     * FUNCTION_CHAIN ::= FUNCTION_CALL { "." FUNCTION_CALL }*
     * @param {Tokenizer} t the Tokenizer
     * @return {Dsl} the Dsl object representing a function call chain
     */
    functionChain(t) {
        let func = this.functionCall(t);
        while (t.peek('.')) {
            t.next('.');
            func.chain(this.functionCall(t));
        }
        return func;
    }

    /**
     * Parse a Dsl function call, or throw.
     * FUNCTION_CALL ::= IDENTIFIER "(" [ EXPRESSION {"," EXPRESSION}* ] ")"
     * @param {Tokenizer} t the Tokenizer
     * @return {Dsl} the Dsl object representing the function call
     */
    functionCall(t) {
        let name = t.nextIdentifier();
        let dsl = new Dsl(this.functionKind(name), name);
        t.next('(');
        while (!t.atEndOfInput()) {
            if (t.peek(')')) {
                // end of params
                break;
            }
            dsl.param(this.expression(t));
            if (t.peek(',')) {
                t.next(',');
                if (t.atEndOfInput()) {
                    throw new DslError('Expected: EXPRESSION but found: end-of-input');
                }
            }
        }
        t.next(')');
        return dsl;
    }

    /**
     * Parse a Dsl constant, e.g. a string or a number, or throw.
     * @param {Tokenizer} t the Tokenizer
     * @return {Dsl} the Dsl object representing the constant
     */
    constant(t) {
        if (t.peek('"')) {
            // a string in double quotes
            return new Dsl(KIND.STRING, JSON.parse(t.nextQuotedString()));
        }
        else if (t.peek('\'')) {
            // a string in single quotes (YAML syntax)
            let s = t.nextSingleQuotedString();
            // convert to double quoted string (JSON syntax)
            s = '"' + s.replace(/^'/, '').replace(/'$/, '').replace(/"/g, '\\\"').replace(/''/g, "'") + '"';
            return new Dsl(KIND.STRING, JSON.parse(s));
        }
        else if (t.peekPortRange()) {
            // a port range
            return new Dsl(KIND.PORT, t.nextPortRange());
        }
        else if (t.peekNumber()) {
            // a floating point number
            return new Dsl(KIND.NUMBER, t.nextNumber());
        }
        return new Dsl(KIND.STRING, t.remainder());
        // previously we did this, but it caused all kinds of errors, as non-json input is common
        // throw new DslError('Expected: CONSTANT but found: ' + t.toJSON());
    }

    /**
     * Find the most appropriate KIND for a function, by comparing
     * its name to all known TARGETS and UTILITIES.
     * @param name the function name
     * @return {*} one of KIND.TARGET, KIND.UTILITY, KIND.METHOD
     */
    functionKind(name) {
        if (TARGETS.includes(name)) {
            return KIND.TARGET;
        }
        else if (UTILITIES.includes(name)) {
            return KIND.UTILITY;
        }
        return KIND.METHOD;
    }
}

/**
 * A string tokenizer. Retrieves tokens, such as symbols, characters,
 * quoted strings, numbers, from a string.
 * It is used by the DslParser to parse complex Dsl expressions.
 */
export class Tokenizer {
    /**
     * @param {string} s the string to tokenize
     */
    constructor(s) {
        // this.s contains the current input buffer
        this.s = s.trim();
    }

    /**
     * Return <code>true</code> if there are no more characters in the input.
     * @return {boolean}
     */
    atEndOfInput() {
        return this.s.length === 0;
    }

    /**
     * Fetch one identifier, such as a function name, or throw.
     * @return {string}
     */
    nextIdentifier() {
        this.skipWhitespace();
        let spl = this.s.split(/\s|[^$A-Za-z0-9_]/, 1);
        if (spl.length > 1) {
            this.s = spl[1];
            return spl[0];
        }
        else if (spl.length === 1) {
            this.skipChars(spl[0].length);
            return spl[0];
        }
        else {
            throw new DslError('Expected IDENTIFIER but found: ' + this.toJSON());
        }
    }

    /**
     * Skip whitespace from the input.
     */
    skipWhitespace() {
        // input was right trimmed, so this is effectively a left trim.
        this.s = this.s.trim();
    }

    /**
     * Fetch the requested symbol, or throw.
     * @param {string} sym one or more non-whitespace characters, e.g.,
     * a reserved keyword or a special character.
     * @return {string}
     */
    next(sym) {
        sym = sym.trim();
        if (sym.length === 0) {
            throw new DslError("Empty symbol");
        }
        this.skipWhitespace();
        if (this.s.startsWith(sym)) {
            this.skipChars(sym.length);
            this.skipWhitespace();
            return sym;
        }
        else {
            throw new DslError('Expected: "' + sym + '" but found: ' + this.toJSON());
        }
    }

    /**
     * Fetch a string in double quotes, or throw.
     * @return {string}
     */
    nextQuotedString() {
        let str = this.next('"');
        let prev = '';
        let curr = '';
        let terminated = false;
        while (!this.atEndOfInput()) {
            curr = this.nextChar();
            str += curr;
            if (prev !== '\\' && curr === '"') {
                // end of string
                terminated = true;
                break;
            }
            prev = curr;
        }
        if (!terminated) {
            throw new DslError('Unterminated quoted string');
        }
        return str;
    }

    /**
     * Fetch a string in single quotes (YAML syntax), or throw.
     * @return {string}
     */
    nextSingleQuotedString() {
        let str = this.next('\'');
        let prev = '';
        let curr = '';
        let terminated = false;
        let doubles = false;
        while (!this.atEndOfInput()) {
            curr = this.nextChar();
            str += curr;
            if (curr === '\'') {
                if (prev === '\'' && doubles === false) {
                    doubles = true;
                }
                else if (this.peek('\'') === false) {
                    // end of string
                    terminated = true;
                    break;
                }
            }
            else {
                doubles = false;
            }
            prev = curr;
        }
        if (!terminated) {
            throw new DslError('Unterminated quoted string');
        }
        return str;
    }

    /**
     * Fetch a literal number, or throw.
     * @return {number}
     */
    nextNumber() {
        let mm = this.s.match(numberRegex);
        if (mm === null) {
            throw new DslError('Expected: NUMBER but found: ' + this.toJSON());
        }
        this.skipChars(mm[0].length);
        return Number(mm[0]);
    }

    /**
     * Fetch a port range, or throw
     * Valid port ranges are, e.g., <code>8080+</code> or <code>1024-32767</code>
     * @return {string}
     */
    nextPortRange() {
        let mm = this.s.match(portRangeRegex);
        if (mm === null) {
            throw new DslError('Expected: PORT_RANGE but found: ' + this.toJSON());
        }
        this.skipChars(mm[0].length);
        return mm[0];
    }

    /**
     * Fetch the next character in the input buffer, or throw.
     * @return {string} the next character
     */
    nextChar() {
        if (!this.atEndOfInput()) {
            let c = this.s.charAt(0);
            this.skipChars(1);
            return c;
        }
        else {
            throw new DslError('Expected CHAR but found: end-of-input');
        }
    }

    /**
     * Consume characters from the start of the input buffer
     * @param num the number of characters to skip
     */
    skipChars(num) {
        this.s = this.s.substring(num);
    }

    remainder() {
        let result = this.s;
        this.s = "";
        return result;
    }

    /**
     * Return <code>true</code> if a call to <code>next(sym)</code> would succeed.
     * @param {string} sym one or more characters, e.g.,
     * a reserved keyword or a special character.
     * @return {boolean}
     */
    peek(sym) {
        return this.s.startsWith(sym);
    }

    /**
     * Return <code>true</code> if a call to <code>nextPortRange()</code> would succeed.
     * @return {boolean}
     */
    peekPortRange() {
        return this.s.search(portRangeRegex) >= 0;
    }

    /**
     * Return <code>true</code> if a call to <code>nextNumber()</code> would succeed.
     * @return {boolean}
     */
    peekNumber() {
        return this.s.search(numberRegex) >= 0;
    }

    /**
     * Return a JSON of the current buffer.
     * Mainly for diagnostic purposes.
     * @return {string}
     */
    toJSON() {
        // FIXME - this is not compatible with JSON.stringify which expects _unserialized_ object
        // ie calling JSON.stringify(this) will result in _twice_ escaped JSON.
        // but need to review uses of this method (in case there is a caller elsewhere who expects
        // valid JSON).  [as noted above in other toJSON, the method name is horribly ambiguous!]
        return JSON.stringify(this.s);
    }
}

export class DslError extends Error {

    constructor(message, options = {}) {
        super(message);
        this.name = 'DslError';
        this.message = message;
        this.id = options.id || 'general-error';
        this.data = options.data || null;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        }
    }
}
