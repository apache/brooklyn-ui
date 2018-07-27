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

/**
 * Creates a customised CodeMirror hint (https://codemirror.net/doc/manual.html#addon_show-hint) based on useful
 * information such has an helper text, a description, etc.
 */
class SuperHint {
    constructor(hint, name, helper, description) {
        this.hint = hint;
        this.name = name;
        this.helper = helper;
        this.description = description;
    }

    /**
     * Returns a an object that can be used by the `show-hint` plugin of CodeMirror. The returned object contains a
     * `render` function that will display a VS editor style hint.
     *
     * @return {{text: *, render: (function(*))}}
     */
    getHint() {
        return {
            text: this.hint,
            render: (li) => {
                let pTitle = document.createElement('p');
                pTitle.className = 'CodeMirror-superhint-title';
                li.appendChild(pTitle);

                let spanName = document.createElement('span');
                spanName.className = 'CodeMirror-superhint-name';
                spanName.appendChild(document.createTextNode(this.name));
                pTitle.appendChild(spanName);

                if (this.helper) {
                    let spanHelper = document.createElement('span');
                    spanHelper.className = 'CodeMirror-superhint-helper';
                    spanHelper.appendChild(document.createTextNode(this.helper));
                    pTitle.appendChild(spanHelper);
                }

                if (this.description) {
                    let pDescription = document.createElement('p');
                    pDescription.className = 'CodeMirror-superhint-description';
                    pDescription.appendChild(document.createTextNode(this.description));
                    li.appendChild(pDescription);
                }
            }
        }
    }
}

CodeMirror.defineExtension('superHint', (hint, name, helper, description) => new SuperHint(hint, name, helper, description));
CodeMirror.defineExtension('superHintLoader', () => {
    let loadingState = document.createElement('ul');
    loadingState.className = 'CodeMirror-hints';
    let loading = loadingState.appendChild(document.createElement('li'));
    loading.className = 'CodeMirror-hint CodeMirror-hint-loading';
    loading.appendChild(document.createTextNode('Loading'));

    return loadingState;
});
CodeMirror.registerHelper('hint', 'super', (cm, callback, options) => {
    let loadingState = cm.superHintLoader();
    let removeLoadingState = () => {
        if (loadingState) {
            loadingState.remove();
        }
        cm.off('cursorActivity', removeLoadingState);
    };

    cm.on('cursorActivity', removeLoadingState);
    cm.addWidget(cm.getCursor(), loadingState);

    let promises = cm.getHelpers(CodeMirror.Pos(0, 0), 'superHint').reduce((promises, helper) => promises.concat(helper(cm, options)), []);

    Promise.all(promises).then(results => {
        removeLoadingState();

        let superHints = results.reduce((hints, result) => {
            let list = hints.list.concat(result.list);
            return Object.assign(hints, result, {list: list});
        }, {list: []});

        superHints.list = superHints.list.map(superHints => superHints.getHint());

        callback(superHints);
    }).catch(error => {
        removeLoadingState();

        CodeMirror.signal(cm, 'superhint-error', error);

        callback({
            list: [],
            from: cm.getCursor(),
            to: cm.getCursor()
        });
    });

});
CodeMirror.hint.super.async = true;

CodeMirror.defineOption('hintOptions', {
    hint: CodeMirror.hint.super,
    completeSingle: false
});