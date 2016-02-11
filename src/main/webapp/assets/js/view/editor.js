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
            'click #button-convert':'convertBlueprint',
            'click #button-switch':'switchMode',
            'click #button-example':'populateExampleBlueprint',
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
                    vm.initializeEditor();
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
            $("#button-example", this.$el).html(this.mode==MODE_CATALOG ? "Insert Catalog Example" : "Insert Blueprint Example");
            $("#button-switch", this.$el).html(this.mode==MODE_CATALOG ? "Switch to Application Blueprint Mode" : "Switch to Catalog Mode");
            this.refreshOnMinorChange();
        },
        refreshOnMinorChange: function() {
            var yaml = this.editor && this.editor.getValue();
            var parse = this.parse();
            
            if (!yaml || parse.problem || this.mode==MODE_CATALOG) {
                $("#button-convert", this.$el).hide();
            } else {
                $("#button-convert", this.$el).html("Convert to Catalog Item");
                $("#button-convert", this.$el).show();
            }
            
            if (!yaml) {
                // no yaml
                $("#button-run", this.$el).attr('disabled','disabled');
                $("#button-delete", this.$el).hide();
                // example and switch mode only shown when empty
                $("#button-example", this.$el).show();
                $("#button-switch", this.$el).show();
            } else {
                $("#button-run", this.$el).attr('disabled','false');
                // we have yaml
                $("#button-run", this.$el).show();
                $("#button-delete", this.$el).show();
                $("#button-example", this.$el).hide();
                $("#button-switch", this.$el).hide();
            }
        },
        initializeEditor: function() {
            var cm = this.editor;
            if (typeof(cm) !== "undefined") {
                var itemText = "";
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
                cm.getDoc().setValue(itemText);
                if (!itemText) {
                    // could populateExampleBlueprint -- but now that is opt-in                    
                }
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
                var that = this;
                this.editor.on("changes", function(editor, changes) {
                    console.log("editor changed", editor, changes);
                    that.refreshOnMinorChange();
                });
            }

            this.initializeEditor();
        },
        parse: function(forceRefresh) {
            if (!forceRefresh && this.lastParse && this.lastParse.input === this.editor.getValue()) {
                // up to date
                return this.lastParse;
            }
            
            if (!this.editor) {
                this.lastParse = { problem: "no editor yet" };
            } else {
                this.lastParse = { input: this.editor.getValue() };
                try {
                    // TODO use new listener for the parser to get tree w parsing info
                    this.lastParse.result = jsYaml.safeLoad(this.editor.getValue());
                } catch (e) {
                    this.lastParse.problem = e;
                }
            }
            return this.lastParse;
        },
        validate: function() {
            var yaml = this.editor.getValue();
            try{
                var parsed = this.parse(true);
                if (parsed.problem) throw parsed.problem;
                return true;
            }catch (e){
                this.showFailure(e.message);
                return false;
            }
        },
        convertBlueprint: function() {
            if (this.mode === MODE_CATALOG) {
                // not yet supported
            } else {
                var newBlueprint = "brooklyn.catalog:\n"+
                    "  version: 0.0.1\n"+
                    "    items:\n"+
                    "    - id: TODO_identifier_for_this_item \n"+
                    "      description: Some text to display about this\n"+
                    "      iconUrl: http://www.apache.org/foundation/press/kit/poweredBy/Apache_PoweredBy.png\n"+
                    "      itemType: template\n"+
                    "      item:\n"+
                    "      - \n"+
                    // indent 8 spaces:
                    this.editor.getValue().replace(/(\n|^)(.*\n|.+$)/gm,'        $1$2');
                this.mode = MODE_CATALOG;
                this.editor.setValue(newBlueprint);
                this.refresh();
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
            this.initializeEditor();
        },
        switchMode: function() {
            this.setMode(this.mode == MODE_CATALOG ? MODE_APP : MODE_CATALOG);
        },
        populateExampleBlueprint: function() {
            this.editor.setValue(this.mode==MODE_CATALOG ? _DEFAULT_CATALOG : _DEFAULT_BLUEPRINT);
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
