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
const CodeMirror = require('codemirror');

CodeMirror.registerGlobalHelper('lint', 'yaml-tab', mode => mode.name === 'yaml', (text, options, cm) => {
    return new Promise(resolve => {
        let issues = [];

        for (let index = 0; index < cm.lineCount(); index++) {
            cm.getLine(index)
                .split('')
                .map((c, i) => ({c: c, i: i}))
                .filter(item => item.c === '\t')
                .forEach(item => {
                    issues.push({
                        from: CodeMirror.Pos(index, item.i),
                        to: CodeMirror.Pos(index, item.i + 1),
                        message: 'Tab character detected. We strongly recommend you to use spaces instead to avoid indentation issues',
                        severity: 'warning'
                    });
                });
        }

        resolve(issues);
    });
});