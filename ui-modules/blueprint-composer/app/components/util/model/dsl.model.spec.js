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
import {Dsl, KIND, DslParser, Tokenizer, DslError, TARGET} from './dsl.model';
import {Entity} from './entity.model';

describe('Dsl Component Model', ()=>{
   describe('Dsl Initialization and expression generation', ()=>{
       it('should initialize correctly', ()=> {
           let dsl1 = new Dsl();
           expect(dsl1._id).not.toBeNull();
           expect(dsl1.kind).toBe(KIND.STRING);
           expect(dsl1.hasName()).toBe(true);
           expect(dsl1.hasParent()).toBe(false);
           expect(dsl1.hasRef()).toBe(false);

           let dsl2 = new Dsl(KIND.STRING, 'hello');
           expect(dsl2._id).not.toBeNull();
           expect(dsl2.kind).toBe(KIND.STRING);
           expect(dsl2.name).toBe('hello');
           expect(dsl2.hasParent()).toBe(false);
           expect(dsl2.hasRef()).toBe(false);

           let dsl3 = new Dsl(KIND.UTILITY, 'formatString');
           expect(dsl3._id).not.toBeNull();
           expect(dsl3.kind).toBe(KIND.UTILITY);
           expect(dsl3.name).toBe('formatString');
       });

       it('should set and get name correctly', ()=> {
           let dsl = new Dsl();
           dsl.name = 'Test' + 'Name';
           expect(dsl.name).toBe('TestName');
       });

       it('should set and get ref correctly', ()=> {
           let entity = new Entity();
           const CONFIG_OBJECT = {
               textKey: 'textValue',
               boolKey: false,
               numKey: 123456789,
               nullKey: null,
               objectKey: {
                   key: 'val',
               }
           };
           entity.setEntityFromJson(CONFIG_OBJECT);

           let dsl = new Dsl();
           dsl.ref = entity;

           expect(dsl.ref).toEqual(entity);
           expect(dsl.kind).toBe(KIND.ENTITY);
       });

       it('should set and get parent hierarchy correctly', ()=> {
           let dsl = new Dsl();
           let child = new Dsl();
           let grandchild = new Dsl();

           child.parent = dsl;
           grandchild.parent = child;

           expect(child.parent).toBe(dsl);
           expect(grandchild.parent).toBe(child);
           expect(grandchild.parent.parent).toBe(dsl);
           expect(grandchild.parent.parent.parent).toBeUndefined();

           expect(dsl.getRoot()).toBe(dsl);
           expect(child.getRoot()).toBe(dsl);
           expect(grandchild.getRoot()).toBe(dsl);
       });

       it('should handle params correctly', ()=> {
           let dsl = new Dsl(KIND.METHOD);

           expect(dsl.params.length).toBe(0);

           let param1 = new Dsl();
           let param2 = new Dsl();
           let param3 = new Dsl();

           dsl.param(param1);
           dsl.param(param2);
           dsl.param(param3);

           expect(dsl.params).toEqual([param1, param2, param3]);

           expect(param1.parent).toBe(dsl);
           expect(param1.getRoot()).toBe(dsl);
           expect(param2.parent).toBe(dsl);
           expect(param2.getRoot()).toBe(dsl);
           expect(param3.parent).toBe(dsl);
           expect(param3.getRoot()).toBe(dsl);
       });

       it('should handle prev and next correctly', ()=> {
           let dsl = new Dsl(KIND.METHOD);

           expect(dsl.next).toBeUndefined();
           expect(dsl.prev).toBeUndefined();

           let meth1 = new Dsl(KIND.METHOD);
           let meth2 = new Dsl(KIND.METHOD);
           let meth3 = new Dsl(KIND.METHOD);

           dsl.chain(meth1);
           expect(dsl.next).toBe(meth1);
           expect(meth1.prev).toBe(dsl);

           dsl.chain(meth2).chain(meth3);
           expect(dsl.prev).toBeUndefined();
           expect(dsl.next).toBe(meth1);
           expect(dsl.getLastMethod()).toBe(meth3);
           expect(meth1.prev).toBe(dsl);
           expect(meth1.next).toBe(meth2);
           expect(meth2.prev).toBe(meth1);
           expect(meth2.next).toBe(meth3);
           expect(meth3.prev).toBe(meth2);
           expect(meth3.next).toBeUndefined();

           dsl.popChainedMethod();
           expect(dsl.prev).toBeUndefined();
           expect(dsl.next).toBe(meth1);
           expect(dsl.getLastMethod()).toBe(meth2);
           expect(meth1.prev).toBe(dsl);
           expect(meth1.next).toBe(meth2);
           expect(meth2.prev).toBe(meth1);
           expect(meth2.next).toBeUndefined();

           expect(dsl.equals(dsl));
       });

       it('should generate YAML correctly', ()=> {
           // constants
           let dsl1 = new Dsl(KIND.STRING, 'hello world');

           expect(dsl1.toString()).toEqual('"hello world"');
           expect(dsl1.generate()).toEqual('"hello world"');

           let dsl2 = new Dsl(KIND.NUMBER, 10.2);

           expect(dsl2.toString()).toEqual('10.2');
           expect(dsl2.generate()).toEqual('10.2');

           // target function without parameters
           let dsl3 = new Dsl(KIND.TARGET, TARGET.SELF);
           expect(dsl3.generateParams()).toEqual('');
           expect(dsl3.toString()).toEqual('$brooklyn:self()');
           expect(dsl3.generate()).toEqual('self()');

           // method with one parameter
           let awr1 = new Dsl(KIND.METHOD, 'attributeWhenReady');
           let par1 = new Dsl(KIND.STRING, 'http.port');
           awr1.param(par1);
           dsl3.chain(awr1);
           expect(awr1.generate()).toEqual('attributeWhenReady("http.port")');

           // the full DSL expression
           expect(dsl3.toString()).toEqual('$brooklyn:self().attributeWhenReady("http.port")');

           // chained target functions and methods: parent().sibling(...).attributeWhenReady(...)
           let dsl4 = new Dsl(KIND.TARGET, TARGET.PARENT);
           let sib1 = new Dsl(KIND.TARGET, TARGET.SIBLING);
           let par2 = new Dsl(KIND.STRING, 'rootNode');
           sib1.param(par2);
           dsl4.chain(sib1);
           expect(sib1.generate()).toEqual('sibling("rootNode")');

           let awr2 = new Dsl(KIND.METHOD, 'attributeWhenReady');
           let par3 = new Dsl(KIND.STRING, 'http.port');
           awr2.param(par3);
           dsl4.chain(awr2);
           expect(awr2.generate()).toEqual('attributeWhenReady("http.port")');

           expect(dsl4.toString()).toEqual('$brooklyn:parent().sibling("rootNode").attributeWhenReady("http.port")');

           // utility function with multiple parameters
           let func1 = new Dsl(KIND.UTILITY, 'formatString');
           let s1 = new Dsl(KIND.STRING, '%s:%s');
           let s2 = new Dsl(KIND.STRING, 'localhost');
           let s3 = new Dsl(KIND.STRING, '8081');
           func1.param(s1);
           func1.param(s2);
           func1.param(s3);
           expect(func1.generate()).toEqual('formatString("%s:%s", "localhost", "8081")');

           // the full DSL expression
           expect(func1.toString()).toEqual('$brooklyn:formatString("%s:%s", "localhost", "8081")');

           // utility function with multiple parameters and nested calls
           let func2 = new Dsl(KIND.UTILITY, 'formatString');
           let ss1 = new Dsl(KIND.STRING, '%s:%s');
           let ss2 = new Dsl(KIND.STRING, 'localhost');
           func2.param(ss1);
           func2.param(ss2);
           func2.param(dsl4);
           expect(func2.generate()).toEqual('formatString("%s:%s", "localhost", $brooklyn:parent().sibling("rootNode").attributeWhenReady("http.port"))');

           // the full DSL expression
           expect(func2.toString()).toEqual('$brooklyn:formatString("%s:%s", "localhost", $brooklyn:parent().sibling("rootNode").attributeWhenReady("http.port"))');

           // utility function with multiple port parameters
           let func3 = new Dsl(KIND.UTILITY, 'formatString');
           let sss1 = new Dsl(KIND.STRING, 'Using ports %s or %s');
           let sss2 = new Dsl(KIND.PORT, '8080+');
           let sss3 = new Dsl(KIND.PORT, '8080-10010');

           // The ports only
           expect(sss2.generate()).toEqual('8080+');
           expect(sss2.toString()).toEqual('8080+');
           expect(sss3.generate()).toEqual('8080-10010');
           expect(sss3.toString()).toEqual('8080-10010');

           func3.param(sss1);
           func3.param(sss2);
           func3.param(sss3);
           expect(func3.generate()).toEqual('formatString("Using ports %s or %s", "8080+", "8080-10010")');

           // the full DSL expression
           expect(func3.toString()).toEqual('$brooklyn:formatString("Using ports %s or %s", "8080+", "8080-10010")');
       });

       it('should handle equals correctly', ()=> {
           let dsl1 = new Dsl(KIND.METHOD, 'hello');
           let dsl2 = new Dsl(KIND.METHOD, 'hello');

           expect(dsl1.equals(dsl2)).toBe(true);
           expect(dsl2.equals(dsl1)).toBe(true);

           let meth1 = new Dsl(KIND.METHOD, "print");
           let meth2 = new Dsl(KIND.METHOD, "print");

           dsl1.chain(meth1);
           dsl2.chain(meth2);

           expect(dsl1.equals(dsl2)).toBe(true);
           expect(dsl2.equals(dsl1)).toBe(true);

           let param1 = new Dsl(KIND.STRING, "world");
           meth1.param(param1);

           let param2 = new Dsl(KIND.STRING, "world");
           meth2.param(param2);

           expect(dsl1.equals(dsl2)).toBe(true);

           expect(meth1.equals(meth2)).toBe(true);

       });
   });
});

describe('Dsl parser', ()=> {

    describe('Tokenizer', () => {
        let qs = '"hello world"'; // a quoted string
        let words = 'word1 word2   word3  ';
        let wsep = 'word1  , word2, word3 ,word4   ';

        it('should initialize correctly', () => {
            let t = new Tokenizer(qs);
        });

        it('should tokenize a double-quoted string', () => {
            let t = new Tokenizer(qs);
            expect(t.atEndOfInput()).toBe(false);
            expect(t.peek('"')).toBe(true);
            expect(t.nextQuotedString()).toEqual(qs);
        });

        it('should tokenize a single-quoted string', () => {
            let sqs = "'I Love Single ''Quotes'''";
            let t = new Tokenizer(sqs);
            expect(t.nextSingleQuotedString()).toEqual(sqs);
        });

        it('should tokenize words', () => {
            let t = new Tokenizer(words);
            expect(t.atEndOfInput()).toBe(false);
            expect(t.peek('"')).toBe(false);
            expect(t.nextIdentifier()).toEqual('word1');
            expect(t.nextIdentifier()).toEqual('word2');
            expect(t.nextIdentifier()).toEqual('word3');
            expect(t.atEndOfInput()).toBe(true);
        });

        it('should tokenize words with separators', () => {
            let t = new Tokenizer(wsep);
            expect(t.atEndOfInput()).toBe(false);
            expect(t.nextIdentifier()).toEqual('word1');
            expect(t.next(',')).toEqual(',');
            expect(t.nextIdentifier()).toEqual('word2');
            expect(t.next(',')).toEqual(',');
            expect(t.nextIdentifier()).toEqual('word3');
            expect(t.next(',')).toEqual(',');
            expect(t.nextIdentifier()).toEqual('word4');
            expect(t.atEndOfInput()).toBe(true);
        });
    });

    describe('DslParser', () => {

        it('should initialize correctly', () => {
            let p = new DslParser("test");
        });

        it('should parse a string literal', () => {
            let p = new DslParser('"Hello"');
            let dsl = p.parse();
            expect(dsl).toBeDefined();
            expect(dsl.kind).toBe(KIND.STRING);
            expect(dsl.name).toEqual('Hello');
        });

        it('should parse a string literal in double quotes containing escaped quotes', () => {
            let cstr2 = '"This is \\"quoted\\""';
            let p = new DslParser(cstr2);
            let dsl = p.parse();
            expect(dsl).toBeDefined();
            expect(dsl.kind).toBe(KIND.STRING);
            expect(dsl.name).toEqual('This is "quoted"');
            expect(dsl.toString()).toEqual(cstr2); // round-trip check
        });

        it('should parse a string literal in single quotes containing escaped quotes', () => {
            let cstrYAML = "'This \"thing\" is ''quoted'''"; // YAML: 'This "thing" is ''quoted'''
            let p = new DslParser(cstrYAML);
            let dsl = p.parse();
            expect(dsl).toBeDefined();
            expect(dsl.kind).toBe(KIND.STRING);
            expect(dsl.name).toEqual("This \"thing\" is 'quoted'");
            expect(dsl.toString()).toEqual('"This \\"thing\\" is \'quoted\'"'); // JSON: "This \"thing\" is 'quoted'"
        });

        it('should parse a variety of number literals', () => {
            let nums = ['1', '123', '-1', '-123',
                '.345', '-.345', '0.', '0.0', '-0.01', '+0.01',
                '9999999999999.123', '-9999999999999.123'];
            for (let cnum of nums) {
                let p = new DslParser(cnum);
                let dsl = p.parse();
                expect(dsl).toBeDefined();
                expect(dsl.kind).toBe(KIND.NUMBER);
                expect(dsl.name).toEqual(Number(cnum).toString());
                expect(dsl.toString()).toEqual(Number(cnum).toString());
            }
        });

        it('should parse a variety of port ranges', () => {
            let portRanges = ['0+', '8080+', '0-65535', '1024-4096'];
            for (let range of portRanges) {
                let p = new DslParser(range);
                let dsl = p.parse();
                expect(dsl).toBeDefined();
                expect(dsl.kind).toBe(KIND.PORT);
                expect(dsl.name).toEqual(range);
                expect(dsl.toString()).toEqual(range);
            }
        });

        it('should parse a utility function call with no params', () => {
            let expr1 = '$brooklyn:formatString()';
            let p = new DslParser(expr1);
            let dsl = p.parse();
            expect(dsl).toBeDefined();
            expect(dsl.kind).toBe(KIND.UTILITY);
            expect(dsl.name).toEqual('formatString');
            expect(dsl.params.length).toBe(0);
            expect(dsl.toString()).toEqual(expr1); // round-trip check
        });

        it('should parse a utility function call with one param', () => {
            let expr2 = '$brooklyn:formatString("hello")';
            let p = new DslParser(expr2);
            let dsl = p.parse();
            expect(dsl).toBeDefined();
            expect(dsl.kind).toBe(KIND.UTILITY);
            expect(dsl.name).toEqual('formatString');
            expect(dsl.params.length).toBe(1);
            expect(dsl.params[0].kind).toBe(KIND.STRING);
            expect(dsl.toString()).toEqual(expr2); // round-trip check
        });

        it('should parse a utility function call with params', () => {
            let expr3 = '$brooklyn:formatString("%s", "hello")';
            let p = new DslParser(expr3);
            let dsl = p.parse();
            expect(dsl).toBeDefined();
            expect(dsl.kind).toBe(KIND.UTILITY);
            expect(dsl.name).toEqual('formatString');
            expect(dsl.params.length).toBe(2);
            expect(dsl.toString()).toEqual(expr3); // round-trip check
        });

        it('should parse a method function call with params', () => {
            let method_expr = '$brooklyn:attributeWhenReady("sensor1")';
            let p = new DslParser(method_expr);
            let dsl = p.parse();
            expect(dsl).toBeDefined();
            expect(dsl.kind).toBe(KIND.METHOD);
            expect(dsl.name).toEqual('attributeWhenReady');
            expect(dsl.params.length).toBe(1);
            expect(dsl.toString()).toEqual(method_expr); // round-trip check
        });

        it('should parse a target function call with no params', () => {
            let target_expr = '$brooklyn:parent()';
            let p = new DslParser(target_expr);
            let dsl = p.parse();
            expect(dsl).toBeDefined();
            expect(dsl.kind).toBe(KIND.TARGET);
            expect(dsl.name).toEqual('parent');
            expect(dsl.params.length).toBe(0);
            expect(dsl.toString()).toEqual(target_expr); // round-trip check
        });

        it('should parse a complex function call', () => {
            let target_expr = '$brooklyn:formatString("%s:%s", "localhost", $brooklyn:parent().sibling("rootNode").attributeWhenReady("http.port"))';
            let p = new DslParser(target_expr);
            let dsl = p.parse();
            expect(dsl).toBeDefined();
            expect(dsl.toString()).toEqual(target_expr); // round-trip check
        });

        it('should get references', () => {
            let target_expr = '$brooklyn:formatString("%s:%s", $brooklyn:component("db").attributeWhenReady("host.address"), $brooklyn:component("nginx").attributeWhenReady("http.port"))';
            let p = new DslParser(target_expr);
            let dsl = p.parse();
            expect(dsl).toBeDefined();
            expect(dsl.toString()).toEqual(target_expr); // round-trip check
            expect(dsl.getReferences().length).toEqual(2);
        });

    });
});

