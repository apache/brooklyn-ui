/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
*/
define([
    "underscore", "jquery", "backbone", "model/catalog-application", "js-yaml", "codemirror",
    "text!tpl/editor/page.html",

    // no constructor
    "jquery-slideto",
    "jquery-wiggle",
    "jquery-ba-bbq",
    "handlebars",
    "bootstrap"
], function (_, $, Backbone, CatalogApplication, jsYaml, CodeMirror, EditorHtml) {
    var _DEFAULT_BLUEPRINT = 'name: Empty Software Process\nlocation: localhost\nservices:\n- type: org.apache.brooklyn.entity.software.base.EmptySoftwareProcess';
    var _DEFAULT_CATALOG = 'brooklyn.catalog:\n  version: 0.0.1\n  items:\n  - id: example\n    description: This is an example catalog application\n    ' +
        'itemType: template\n    item:\n      name: Empty Software Process\n      services:\n      - type: org.apache.brooklyn.entity.software.base.EmptySoftwareProcess';

    var EditorView = Backbone.View.extend({
        tagName:"div",
        className:"container container-fluid",
        events: {
            'click #button-run':'runBlueprint',
            'click #button-delete':'removeBlueprint',
        },
        editorTemplate:_.template(EditorHtml),

        editor: null,

        initialize:function () {
            var vm = this;
            this.options.catalog = new CatalogApplication.Collection();
            this.options.catalog.fetch({
                data: $.param({allVersions: true}),
                success: function () {
                    vm.refreshEditor();
                }
            });
        },
        render:function (eventName) {
            this.$el.html(_.template(EditorHtml, {}));
            this.loadEditor();
            return this;
        },
        refreshEditor: function() {
            var cm = this.editor;
            if (typeof(cm) !== "undefined") {
                if(this.options.type && this.options.type === 'catalog'){
                    cm.getDoc().setValue(_DEFAULT_CATALOG);
                }else{
                    //assume blueprint
                    var item = this.options.catalog.getId(this.options.typeId);
                    cm.getDoc().setValue((item ? item['attributes']['planYaml'] : _DEFAULT_BLUEPRINT ));
                }
                cm.focus();
                cm.refresh();
            }

        },
        loadEditor: function() {
            if (this.editor == null) {
                this.editor = CodeMirror.fromTextArea(this.$("#yaml_code")[0], {
                    lineNumbers: true,
                    extraKeys: {"Ctrl-Space": "autocomplete"},
                    // TODO: feature request: to allow custom theme: http://codemirror.net/demo/theme.html#base16-light
                    mode: {
                        name: "yaml",
                        globalVars: true
                    }
                });
            }

            this.refreshEditor();
        },
        validate: function() {
            var yaml = this.editor.getValue();
            try{
                jsYaml.safeLoad(yaml);
                log('valid yaml :: true');
                return true;
            }catch (e){
                this.showFailure(e.message);
                log('valid yaml :: false');
                return false;
            }
        },
        runBlueprint: function() {
            if (this.validate()){
                if(this.editor.getValue().slice(0,16) === 'brooklyn.catalog'){
                    this.submitCatalog();
                }else{
                    this.submitApplication();
                }
            }
        },
        removeBlueprint: function() {
            this.refreshEditor();

        },
        onSubmissionComplete: function(succeeded, data, type) {
            var that = this;
            if(succeeded){
                log("Submit [succeeded] ... redirecting back to " + type);
                if(type && type === 'catalog'){
                    Backbone.history.navigate('v1/catalog' ,{trigger: true});
                }else{
                    Backbone.history.navigate('v1/home' ,{trigger: true});
                }
            }else{
                log("Submit [failed] ... " + data.responseText);
                var response, summary="Server responded with an error";
                try {
                    if (data.responseText) {
                        response = JSON.parse(data.responseText)
                        if (response) {
                            summary = response.message;
                        }
                    }
                } catch (e) {
                    summary = data.responseText;
                }
                that.showFailure(summary);
            }
        },
        submitApplication: function () {
            var that = this
            $.ajax({
                url:'/v1/applications',
                type:'post',
                contentType:'application/yaml',
                processData:false,
                data: that.editor.getValue(),
                success:function (data) {
                    that.onSubmissionComplete(true, data);
                },
                error:function (data) {
                    that.onSubmissionComplete(false, data);
                }
            });

            return false
        },
        submitCatalog: function () {
            log("submitCatalog");
            var that = this;
            $.ajax({
                url:'/v1/catalog',
                type:'post',
                contentType:'application/yaml',
                processData:false,
                data: that.editor.getValue(),
                success:function (data) {
                    that.onSubmissionComplete(true, data, 'catalog')
                },
                error:function (data) {
                    that.onSubmissionComplete(false, data, 'catalog')
                }
            });
            return false;
        },
        showFailure: function(text) {
            if (!text) text = "Failure performing the specified action";
            log("showing error: "+text);
            this.$('div.error-message .error-message-text').html(_.escape(text));
            // flash the error, but make sure it goes away (we do not currently have any other logic for hiding this error message)
            this.$('div.error-message').slideDown(250).delay(10000).slideUp(500);
        }
    });

    return EditorView;
});
