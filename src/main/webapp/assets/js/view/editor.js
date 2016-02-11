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
    var _DEFAULT_BLUEPRINT = 
        'name: Sample Blueprint\n'+
        'description: runs `sleep` for sixty seconds then stops triggering ON_FIRE in Brooklyn\n'+
        'location: localhost\n'+
        'services:\n'+
        '- type: org.apache.brooklyn.entity.software.base.VanillaSoftwareProcess\n'+
        '  launch.command: |\n'+
        '    echo hello world\n'+
        '    nohup sleep 60 &\n'+
        '    echo $! > ${PID_FILE:-pid.txt}\n';
    var _DEFAULT_CATALOG = 
        'brooklyn.catalog:\n'+
        '  version: 0.0.1\n'+
        '  items:\n'+
        '  - id: example\n'+
        '    description: This is an example catalog application\n'+
        '    itemType: template\n'+
        '    item:\n'+
        '      name: Sample Blueprint Template\n'+
        '      services:\n'+
        '      - type: <your service here>\n'+
        '      location: <your cloud here>\n';
        
    // is the user working on an app blueprint or a catalog item
    var MODE_APP = "app";
    var MODE_CATALOG = "catalog";

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
            if (!this.options.type || this.options.type === MODE_APP) {
                this.setMode(MODE_APP);
            } else if (this.options.type === MODE_CATALOG) {
                this.setMode(MODE_CATALOG);
            } else {
                console.log("unknown mode '"+this.option.type+"'; using '"+MODE_APP+"'");
                this.setMode(MODE_APP);
            }
            this.options.catalog = new CatalogApplication.Collection();
            this.options.catalog.fetch({
                data: $.param({allVersions: true}),
                success: function () {
                    vm.refreshEditor();
                }
            });
        },
        setMode: function(mode) {
            if (this.mode === mode) return;
            this.mode = mode;
            this.refresh();
        },
        render:function (eventName) {
            this.$el.html(_.template(EditorHtml, {}));
            this.loadEditor();
            this.refresh();
            return this;
        },
        refresh: function() {
            $("#button-run", this.$el).html(this.mode==MODE_CATALOG ? "Add to Catalog" : "Deploy");
            $("#button-delete", this.$el).html("Clear");
        },
        refreshEditor: function() {
            var cm = this.editor;
            if (typeof(cm) !== "undefined") {
                var itemText;
                if (this.options.typeId === '_') {
                    // _ indicates a literal is being supplied
                    itemText = this.options.content;
                } else {
                    if (this.options.content) {
                        console.log('ignoring content when typeId is not _; given:', this.options.type, this.options.typeId, this.options.content);
                    } 
                    if (this.options.typeId) {
                        var item = this.options.catalog.getId(this.options.typeId);
                        if (item) itemText = item['attributes']['planYaml'];
                        if (!itemText) {
                            itemText = '# unknown type - this is an example blueprint that would reference it\n'+
                                'services:\n- type: '+this.options.typeId+'\n';
                            
                        }
                    }
                }
                if (!itemText) {
                    if (this.options.type === 'catalog') {
                        itemText = _DEFAULT_CATALOG;
                    } else {
                        itemText = _DEFAULT_BLUEPRINT;
                    }
                }
                cm.getDoc().setValue(itemText);
                //better not to focus as focussing puts the cursor at the beginning which is odd
                //and cmd-shift-[ and tab are intercepted so user can't navigate
                // cm.focus();
                cm.refresh();
            }

        },
        loadEditor: function() {
            if (this.editor == null) {
                this.editor = CodeMirror.fromTextArea(this.$("#yaml_code")[0], {
                    lineNumbers: true,
                    extraKeys: {"Ctrl-Space": "autocomplete"},
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
                return true;
            }catch (e){
                this.showFailure(e.message);
                return false;
            }
        },
        runBlueprint: function() {
            if (this.validate()){
                if (this.mode === MODE_CATALOG) {
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
            var that = this;
            $.ajax({
                url:'/v1/catalog',
                type:'post',
                contentType:'application/yaml',
                processData:false,
                data: that.editor.getValue(),
                success:function (data) {
                    that.onSubmissionComplete(true, data, 'catalog');
                },
                error:function (data) {
                    that.onSubmissionComplete(false, data, 'catalog');
                }
            });
            return false;
        },
        showFailure: function(text) {
            var _text = text || "Failure performing the specified action";
            log("showing error: "+_text);
            this.$('div.error-message .error-message-text').html(_.escape(_text));
            // flash the error, but make sure it goes away (we do not currently have any other logic for hiding this error message)
            this.$('div.error-message').slideDown(250).delay(10000).slideUp(500);
        }
    });

    return EditorView;
});
