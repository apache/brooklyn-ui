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

/**
 * Supplies a modal (wizardy) with a list of apps a user can pick.
 * Templates (items with yaml and with a location) go to composer, 
 * other items (java, or yaml without a location) go to next *or* yaml composer. 
 */
 
define([
    "underscore", "jquery", "backbone", "brooklyn-utils", "js-yaml", "codemirror",
    "model/entity", "model/application", "model/location", "model/catalog-application",
    "text!tpl/app-add-wizard/modal-wizard.html",
    "text!tpl/app-add-wizard/create.html",
    "text!tpl/app-add-wizard/create-step-template-entry.html", 
    "text!tpl/app-add-wizard/required-config-entry.html",
    "text!tpl/app-add-wizard/edit-config-entry.html",
    "text!tpl/app-add-wizard/deploy.html",
    "text!tpl/app-add-wizard/deploy-version-option.html",
    "text!tpl/app-add-wizard/deploy-location-row.html",
    "text!tpl/app-add-wizard/deploy-location-option.html",
    //below not part of constructor
    "codemirror-mode-yaml",
    "codemirror-addon-show-hint",
    "codemirror-addon-anyword-hint",
    "codemirror-addon-display-placeholder",
    "bootstrap"
], function (_, $, Backbone, Util, JsYaml, CodeMirror, Entity, Application, Location, CatalogApplication,
             ModalHtml, CreateHtml, CreateStepTemplateEntryHtml, 
             RequiredConfigEntryHtml, EditConfigEntryHtml, DeployHtml,
             DeployVersionOptionHtml, DeployLocationRowHtml, DeployLocationOptionHtml
) {
    /** Special ID to indicate that no locations will be provided when starting the server. */
    var NO_LOCATION_INDICATOR = "__NONE__";

    function setVisibility(obj, isVisible) {
        if (isVisible) obj.show();
        else obj.hide();
    }

    function setEnablement(obj, isEnabled) {
        obj.attr("disabled", !isEnabled)
    }
    
    /** converts old-style spec with "entities" to camp-style spec with services */
    function oldSpecToCamp(spec) {
        var services;
        if (spec.type) {
            services = [entityToCamp({type: spec.type, version: spec.version, config: spec.config})];
        } else if (spec.entities) {
            services = [];
            var entities = spec.entities;
            for (var i = 0; i < entities.length; i++) {
                services.push(entityToCamp(entities[i]));
            }
        }
        var result = {};
        if (spec.name) result.name = spec.name;
        if (spec.locations) {
          if (spec.locations.length>1)
            result.locations = spec.locations;
          else
            result.location = spec.locations[0];
        }
        if (services) result.services = services;
        // NB: currently nothing else is supported in this spec
        return result;
    }
    function entityToCamp(entity) {
        var result = {};
        if (entity.name && (!options || !options.exclude_name)) result.name = entity.name;
        if (entity.type) result.type = entity.type;
        if (entity.type && entity.version) result.type += ":" + entity.version;
        if (entity.config && _.size(entity.config)) result["brooklyn.config"] = entity.config;
        return result;
    }
    function getConvertedConfigValue(value) {
        try {
            return $.parseJSON(value);
        } catch (e) {
            return value;
        }
    }

    function redirectToEditorTabToDeployId(catalogId){
        redirectTo("/v1/editor/app/"+ (typeof catalogId === 'string' ? catalogId : '')); 
    }
    function redirectToEditorTabToDeployYaml(yaml){
        redirectTo("/v1/editor/app/_/"+encodeURIComponent(yaml));
    }
    function redirectTo(url){
        var $modal = $('.add-app #modal-container .modal');
        $modal.modal('hide');
        $modal.fadeTo(500,1);
        Backbone.history.navigate(url, {trigger: true});
    }
        
    
    var ModalWizard = Backbone.View.extend({
        tagName:'div',
        className:'modal hide fade',
        events:{
            'click #prev_step':'prevStep',
            'click #next_step':'nextStep',
            'click #preview_step':'previewStep',
            'click #finish_step':'finishStep'
        },
        template:_.template(ModalHtml),
        initialize:function () {
            this.catalog = {}
            this.catalog.applications = {}
            this.model = {}
            this.model.spec = new Application.Spec;
            this.model.yaml = "";
            this.currentStep = 0;
            this.steps = [
                          {
                              step_id:'what-app',
                              title:'Create Application',
                              instructions:'Choose or build the application to deploy',
                              view:new ModalWizard.StepCreate({ model:this.model, wizard: this, catalog: this.catalog })
                          },
                          {
                              // TODO rather than make this another step -- since we now on preview revert to the yaml tab
                              // this should probably be shown in the catalog tab, replacing the other contents.
                              step_id:'name-and-locations',
                              title:'<%= appName %>',
                              instructions:'Specify the locations to deploy to and any additional configuration',
                              view:new ModalWizard.StepDeploy({ model:this.model, catalog: this.catalog })
                          }
                          ]
        },
        beforeClose:function () {
            // ensure we close the sub-views
            _.each(this.steps, function (step) {
                step.view.close()
            }, this)
        },
        render:function () {
            this.$el.html(this.template({}))
            this.renderCurrentStep()
            return this
        },

        renderCurrentStep:function (callback) {
            var name = this.model.name || "";
            this.title = this.$("h3#step_title")
            this.instructions = this.$("p#step_instructions")

            var currentStepObj = this.steps[this.currentStep]
            this.title.html(_.template(currentStepObj.title)({appName: name}));
            this.instructions.html(currentStepObj.instructions)
            this.currentView = currentStepObj.view
            
            // delegate to sub-views !!
            this.currentView.render()
            this.currentView.updateForState()
            this.$(".modal-body").replaceWith(this.currentView.el)
            if (callback) callback(this.currentView);

            this.updateButtonVisibility();
        },
        updateButtonVisibility:function () {
            var currentStepObj = this.steps[this.currentStep]
            
            setVisibility(this.$("#prev_step"), (this.currentStep > 0))

            var isTemplateWithLocation = false;
            {
                var yaml = (this.currentView && this.currentView.selectedTemplate && this.currentView.selectedTemplate.yaml);
                if (yaml) {
                    try {
                        yaml = JsYaml.safeLoad(yaml);
                        hasLocation = yaml.location || yaml.locations;
                        if (!hasLocation) {
                          // look for locations defined in locations
                          svcs = yaml.services;
                          if (svcs) {
                            for (svcI in svcs) {
                              if (svcs[svcI].location || svcs[svcI].locations) {
                                hasLocation = true;
                                break;
                              }
                            }
                          }
                        }
                        isTemplateWithLocation = (hasLocation ? true : false);
                    } catch (e) {
                        log("Warning: could not parse yaml template of selected item")
                        log(yaml);
                    }
                }
            }
            
            // preview (aka "YAML Composer") enabled and shown always
            setVisibility(this.$("#preview_step"), true);
            setEnablement(this.$("#preview_step"), true)
            
            // next shown for first step, but not for templates
            var nextVisible = (this.currentStep < 1) && (!this.isTemplate);
            setVisibility(this.$("#next_step"), nextVisible);
            
            // now set next/preview enablement
            var nextEnabled = true;
            if (this.currentStep==0 && currentStepObj && currentStepObj.view) {
                // disable if nothing is selected in template (app lozenge list) view
                // or if it is a template with a location
                if (!currentStepObj.view.selectedTemplate || isTemplateWithLocation)
                    nextEnabled = false;
            }
                
            if (nextVisible) setEnablement(this.$("#next_step"), nextEnabled)
            
            // finish ("deploy") is shown on the config step
            var finishVisible = (this.currentStep >= 1);
            var finishEnabled = finishVisible;
            setVisibility(this.$("#finish_step"), finishVisible)
            setEnablement(this.$("#finish_step"), finishEnabled)
        },
        
        submitApplication:function (event) {
            var that = this
            var $modal = $('.add-app #modal-container .modal')
            $modal.fadeTo(500,0.5);
            
            var yaml;
            // Drop any "None" locations.
            this.model.spec.pruneLocations();
            yaml = JsYaml.safeDump(oldSpecToCamp(this.model.spec.toJSON()));

            $.ajax({
                url:'/v1/applications',
                type:'post',
                contentType:'application/yaml',
                processData:false,
                data:yaml,
                success:function (data) {
                    that.onSubmissionComplete(true, data, $modal)
                },
                error:function (data) {
                    that.onSubmissionComplete(false, data, $modal)
                }
            });

            return false
        },
        onSubmissionComplete: function(succeeded, data, $modal) {
            var that = this;
            if (succeeded) {
                $modal.modal('hide')
                $modal.fadeTo(500,1);
                if (that.options.callback) that.options.callback();             
            } else {
                log("ERROR submitting application: "+data.responseText);
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
                that.$el.fadeTo(100,1).delay(200).fadeTo(200,0.2).delay(200).fadeTo(200,1);
                that.steps[that.currentStep].view.showFailure(summary)
            }
        },

        prevStep:function () {
            this.currentStep -= 1;
            this.renderCurrentStep();
        },
        nextStep:function () {
            if (this.currentStep == 0) {
                if (this.currentView.validate()) {
                    // next not visible if it's a template, so go to create (configure) step
                    this.currentStep += 1;
                    this.renderCurrentStep();
                } else {
                    // the call to validate will have done the showFailure
                }
            } else {
                throw "Unexpected step: "+this.currentStep;
            }
        },
        previewStep:function () {
            // no need for validation if going to composer

            // When user jump to the YAML editor he also must have the config values that he set through the UI.
            // The config is set implicitly when user clicks deploy and StepDeploy.validate is called.
            this.currentView.model.spec.set("config", this.currentView.getConfigMap());
            if (this.currentStep==0) {
                // from first step, composer should load yaml from the catalog item
                if (this.currentView.selectedTemplate && this.currentView.selectedTemplate.id) {
                    redirectToEditorTabToDeployId(this.currentView.selectedTemplate.id);
                } else {
                    redirectToEditorTabToDeployId();
                }
            } else {
                // on second step we generate yaml
                // Drop any "None" locations.
                this.model.spec.pruneLocations();
                var yaml = JsYaml.safeDump(oldSpecToCamp(this.model.spec.toJSON()));

                redirectToEditorTabToDeployYaml(yaml);
            }
        },
        finishStep:function () {
            if (this.currentView.validate()) {
                this.submitApplication()
            } else {
                // call to validate should showFailure
            }
        },
    })
    
    // Note: this does not restore values on a back click; setting type and entity type+name is easy,
    // but relevant config lines is a little bit more tedious
    ModalWizard.StepCreate = Backbone.View.extend({
        className:'modal-body',
        events:{
            'click #remove-config':'removeConfigRow',
            'click #add-config':'addConfigRow',
            'click .template-lozenge':'templateClick',
            'keyup .text-filter input':'applyFilter',
            'change .text-filter input':'applyFilter',
            'paste .text-filter input':'applyFilter',
            'shown a[data-toggle="tab"]':'onTabChange',
            'click #templateTab #catalog-add':'switchToCatalogAdd',
            'click #templateTab #catalog-yaml':'redirectToEditorTab'
        },
        template:_.template(CreateHtml),
        wizard: null,
        initialize:function () {
            var self = this
            self.catalogEntityIds = []

            this.$el.html(this.template({}))

            // TODO: Make into models, allow options to override, then pass in in test
            // with overrridden url. Can then think about fixing tests in application-add-wizard-spec.js.
            $.get('/v1/catalog/entities', {}, function (result) {
                self.catalogEntityItems = result
                self.catalogEntityIds = _.map(result, function(item) { return item.id })
            });
            
            this.options.catalog.applications = new CatalogApplication.Collection();
            this.options.catalog.applications.fetch({
                data: $.param({
                    allVersions: true
                }),
                success: function (collection, response, options) {
                    $('#catalog-applications-throbber').hide();
                    $('#catalog-applications-empty').hide();
                    if (collection.size() > 0) {
                        self.addTemplateLozenges();
                    } else {
                        $('#catalog-applications-empty').show();
                    }
                }
            });
        },
        renderConfiguredEntities:function () {
            var $configuredEntities = this.$('#entitiesAccordionish').empty()
            var that = this
            if (this.model.spec.get("entities") && this.model.spec.get("entities").length > 0) {
                _.each(this.model.spec.get("entities"), function (entity) {
                    that.addEntityHtml($configuredEntities, entity)
                })
            }
        },
        updateForState: function () {},
        render:function () {
            this.renderConfiguredEntities();
            this.delegateEvents();
            return this;
        },
        // TODO tabs no longer relevant
        onTabChange: function(e) {
            var tabText = $(e.target).text();
            if (tabText=="Catalog") {
                $("li.text-filter").show()
            } else {
                $("li.text-filter").hide()
            }

            if (this.options.wizard)
                this.options.wizard.updateButtonVisibility();
        },
        switchToCatalogAdd: function() {
            var $modal = $('.add-app #modal-container .modal')
            $modal.modal('hide');
            window.location.href="#v1/catalog/new";
        },
        redirectToEditorTab: function () {
            redirectToEditorTabToDeployId();
        },
        applyFilter: function(e) {
            var filter = $(e.currentTarget).val().toLowerCase()
            if (!filter) {
                $(".template-lozenge").show()
            } else {
                _.each($(".template-lozenge"), function(it) {
                    var viz = $(it).text().toLowerCase().indexOf(filter)>=0
                    if (viz)
                        $(it).show()
                    else
                        $(it).hide()
                })
            }
        },
        addTemplateLozenges: function(event) {
            var that = this
            _.each(this.options.catalog.applications.getDistinctApplications(), function(item) {
                that.addTemplateLozenge(that, item[0])
            })
        },
        addTemplateLozenge: function(that, item) {
            var $tempel = _.template(CreateStepTemplateEntryHtml, {
                id: item.get('id'),
                type: item.get('type'),
                name: item.get('name') || item.get('id'),
                description: item.get('description'),
                planYaml:  item.get('planYaml'),
                iconUrl: item.get('iconUrl')
            })
            $("#create-step-template-entries", that.$el).append($tempel)
        },
        templateClick: function(event) {
            var $tl = $(event.target).closest(".template-lozenge");
            var wasSelected = $tl.hasClass("selected")
            $(".template-lozenge").removeClass("selected")
            if (!wasSelected) {
                $tl.addClass("selected")
                this.selectedTemplate = {
                    id: $tl.attr('id'),
                    type: $tl.data('type'),
                    name: $tl.data("name"),
                    yaml: $tl.data("yaml"),
                };
            } else {
                this.selectedTemplate = null;
            }

            if (this.options.wizard)
                this.options.wizard.updateButtonVisibility();
        },
        getConfigMap:function (root) {
            var map = {}
            $('.app-add-wizard-config-entry',root).each( function (index,elt) {
                var value = getConvertedConfigValue($('#value',elt).val());
                if (value !== null) {
                    map[$('#key',elt).val()] = value;
                }
            })
            return map;
        },
        saveTemplate:function () {
            if (!this.selectedTemplate) return false
            var type = this.selectedTemplate.type;
            if (!this.options.catalog.applications.hasType(type)) {
                $('.entity-info-message').show('slow').delay(2000).hide('slow')
                return false
            }

            this.model.spec.set("type", type);
            this.model.name = this.selectedTemplate.name;
            this.model.catalogEntityData = "LOAD"
            return true;
        },
        saveAppClass:function () {
            var that = this
            var tab = $.find('#appClassTab')
            var type = $(tab).find('#app-java-type').val()
            if (!this.options.catalog.applications.hasType(type)) {
                $('.entity-info-message').show('slow').delay(2000).hide('slow')
                return false
            }
            this.model.spec.set("type", type);
            return true;
        },
        addEntityHtml:function (parent, entity) {
            var $entity = _.template(CreateEntityEntryHtml, {})
            var that = this
            parent.append($entity)
            parent.children().last().find('.entity-type-input').typeahead({ source: that.catalogEntityIds })
        },

        addConfigRow:function (event) {
            var $row = _.template(EditConfigEntryHtml, {})
            $(event.currentTarget).parent().prev().append($row)
        },
        removeConfigRow:function (event) {
            $(event.currentTarget).parent().remove()
        },

        validate:function () {
            var that = this;
            delete this.model.spec.attributes["id"]
            if (this.saveTemplate()) {
                this.model.spec.set("entities", []);
                return true
            }
            this.showFailure("Invalid application type/spec");
            return false
        },

        showFailure: function(text) {
            if (!text) text = "Failure performing the specified action";
            this.$('div.error-message .error-message-text').html(_.escape(text));
            this.$('div.error-message').slideDown(250).delay(10000).slideUp(500);
        }

    })

    ModalWizard.StepDeploy = Backbone.View.extend({
        className:'modal-body',

        events:{
            'click #add-selector-container':'addLocation',
            'click #remove-app-location':'removeLocation',
            'change .select-version': 'selectionVersion',
            'change .select-location': 'selectionLocation',
            'blur #application-name':'updateName',
            'click #remove-config':'removeConfigRow',
            'click #add-config':'addConfigRow'
        },

        template:_.template(DeployHtml),
        versionOptionTemplate:_.template(DeployVersionOptionHtml),
        locationRowTemplate:_.template(DeployLocationRowHtml),
        locationOptionTemplate:_.template(DeployLocationOptionHtml),

        initialize:function () {
            this.model.spec.on("change", this.render, this)
            this.$el.html(this.template())
            this.locations = new Location.Collection()
        },
        beforeClose:function () {
            this.model.spec.off("change", this.render)
        },
        renderName:function () {
            this.$('#application-name').val(this.model.spec.get("name"))
        },
        renderVersions: function() {
            var optionTemplate = this.versionOptionTemplate
                select = this.$('.select-version')
                container = this.$('#app-versions')
                defaultVersion = '0.0.0.SNAPSHOT';

            select.empty();

            var versions = this.options.catalog.applications.getVersions(this.model.spec.get('type'));
            for (var vi = 0; vi < versions.length; vi++) {
                var version = versions[vi];
                select.append(optionTemplate({
                    version: version
                }));
            }

            if (versions.length === 1 && versions[0] === defaultVersion) {
                this.model.spec.set('version', '');
                container.hide();
            } else {
                this.model.spec.set('version', versions[0]);
                container.show();
            }
        },
        renderAddedLocations:function () {
            // renders the locations added to the model
            var rowTemplate = this.locationRowTemplate,
                optionTemplate = this.locationOptionTemplate,
                container = this.$("#selector-container-location");
            container.empty();
            for (var li = 0; li < this.model.spec.get("locations").length; li++) {
                var chosenLocation = this.model.spec.get("locations")[li];
                container.append(rowTemplate({
                    initialValue: chosenLocation,
                    rowId: li
                }));
            }
            var $locationOptions = container.find('.select-location');
            var templated = this.locations.map(function(aLocation) {
                return optionTemplate({
                    id: aLocation.getIdentifierName() || aLocation.id || "",
                    name: aLocation.getPrettyName()
                });
            });

            // insert "none" location
            $locationOptions.append(templated.join(""));
            $locationOptions.each(function(i) {
                var option = $($locationOptions[i]);
                option.val(option.parent().attr('initialValue'));
                // Only append dashes if there are any locations
                if (option.find("option").length > 0) {
                    option.append("<option disabled>------</option>");
                }
                option.append(optionTemplate({
                    id: NO_LOCATION_INDICATOR,
                    name: "None"
                }));
            });
        },
        render:function () {
            this.delegateEvents()
            return this
        },
        updateForState: function () {
            var that = this
            // clear any error message (we are being displayed fresh; if there are errors in the update, we'll show them in code below)
            this.$('div.error-message').hide();
            this.renderName()
            this.renderVersions()
            this.locations.fetch({
                success:function () {
                    if (that.model.spec.get("locations").length==0)
                        that.addLocation()
                    else
                        that.renderAddedLocations()
                }})
                
            if (this.model.catalogEntityData==null) {
                this.renderStaticConfig(null)
            } else if (this.model.catalogEntityData=="LOAD") {
                this.renderStaticConfig("LOADING")
                $.get('/v1/catalog/entities/'+this.model.spec.get("type"), {}, function (result) {
                    that.model.catalogEntityData = result
                    that.renderStaticConfig(that.model.catalogEntityData)
                })
            } else {
                this.renderStaticConfig(this.model.catalogEntityData)
            }            
        },
        addLocation:function () {
            if (this.locations.models.length>0) {
                this.model.spec.addLocation(this.locations.models[0].getIdentifierName())
            } else {
                // i.e. No location
                this.model.spec.addLocation(undefined);
            }
            this.renderAddedLocations()
        },
        removeLocation:function (event) {
            var toBeRemoved = $(event.currentTarget).parent().attr('rowId')
            this.model.spec.removeLocationIndex(toBeRemoved)
            this.renderAddedLocations()
        },
        addConfigRow:function (event) {
            var $row = _.template(EditConfigEntryHtml, {})
            $(event.currentTarget).parent().prev().append($row)
        },
        removeConfigRow:function (event) {
            $(event.currentTarget).parent().parent().remove()
        },
        renderStaticConfig:function (catalogEntryItem) {
            this.$('.config-table').html('')
            if (catalogEntryItem=="LOADING") {
                this.$('.required-config-loading').show()
            } else {
                var configs = []
                this.$('.required-config-loading').hide()
                if (catalogEntryItem!=null && catalogEntryItem.config!=null) {
                    var that = this
                    _.each(catalogEntryItem.config, function (cfg) {
                        if (cfg.priority !== undefined) {
                            var html = _.template(RequiredConfigEntryHtml, {data:cfg});
                            that.$('.config-table').append(html)
                        }
                    })
                }
            }
        },
        getConfigMap:function() {
            var map = {};
            $('.app-add-wizard-config-entry').each( function (index,elt) {
                var value = $('#checkboxValue',elt).length ? $('#checkboxValue',elt).is(':checked') :
                    getConvertedConfigValue($('#value',elt).val());
                if (value !== null) {
                    map[$('#key',elt).val()] = value;
                }
            })
            return map;
        },
        selectionVersion:function (event) {
            this.model.spec.set("version", $(event.currentTarget).val())
        },
        selectionLocation:function (event) {
            var loc_id = $(event.currentTarget).val(),
                isNoneLocation = loc_id === NO_LOCATION_INDICATOR;
            var locationValid = isNoneLocation || this.locations.find(function (candidate) {
                return candidate.getIdentifierName()==loc_id;
            });
            if (!locationValid) {
                log("invalid location "+loc_id);
                this.showFailure("Invalid location "+loc_id);
                this.model.spec.set("locations",[]);
            } else {
                var index = $(event.currentTarget).parent().attr('rowId');
                this.model.spec.setLocationAtIndex(index, isNoneLocation ? undefined : loc_id);
            }
        },
        updateName:function () {
            var name = this.$('#application-name').val();
            if (name)
                this.model.spec.set("name", name);
            else
                this.model.spec.set("name", "");
        },
        validate:function () {
            this.model.spec.set("config", this.getConfigMap())
            if (this.model.spec.get("locations").length !== 0) {
                return true;
            } else {
                this.showFailure("A location is required");
                return false;
            }
        },
        showFailure: function(text) {
            if (!text) text = "Failure performing the specified action";
            log("showing error: "+text);
            this.$('div.error-message .error-message-text').html(_.escape(text));
            // flash the error, but make sure it goes away (we do not currently have any other logic for hiding this error message)
            this.$('div.error-message').slideDown(250).delay(10000).slideUp(500);
        }
    })
    
    return ModalWizard
})
