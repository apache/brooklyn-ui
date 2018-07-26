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
import CodeMirror from 'codemirror';

const pattern = /:\s+&(\w+)/g;

CodeMirror.registerGlobalHelper('superHint', 'yamlAnchor', mode => mode.name === 'yaml', (cm) => {
    return new Promise((resolve, reject) => {
        let cursor = cm.getCursor();
        let currentText = cm.getLine(cursor.line);

        let separatorMatch = currentText.match(/:\s+/);
        let isKey = separatorMatch === null || cursor.ch < separatorMatch['index'] + separatorMatch[0].length;
        let listMatch = currentText.match(/^\s*-\s+$/);
        let isListValue = listMatch !== null;

        let start = cursor.ch;
        while (start && !/(\s)/.test(currentText.charAt(start - 1))) {
            --start;
        }
        let keyword = currentText.slice(start, cursor.ch);
        if (keyword.charAt(0) === '*') {
            keyword = keyword.substr(1);
        }

        let hints = {
            list: [],
            from: CodeMirror.Pos(cursor.line, start),
            to: cursor
        };

        if (!isKey || isListValue) {
            let previousText = cm.getRange(CodeMirror.Pos(0, 0), cm.getCursor());
            let match;
            while ((match = pattern.exec(previousText)) !== null) {
                if (match[1].indexOf(keyword) > -1) {
                    hints.list.push(cm.superHint(`*${match[1]}`, match[1], 'anchor'));
                }
            }
        }

        resolve(hints);
    });
});
