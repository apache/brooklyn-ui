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
    'underscore', 'backbone', 'jquery', 'brooklyn-utils', 'model/location',
    'text!tpl/location-wizard/modal.html',
    'text!tpl/location-wizard/location-type.html',
    'text!tpl/location-wizard/location-configuration.html',
    'text!tpl/location-wizard/location-provisioning.html',
    'text!tpl/app-add-wizard/edit-config-entry.html',
], function(_, Backbone, $, Util, Location, ModalHtml, LocationTypeHtml, LocationConfigurationHtml, LocationProvisioningHtml, EditConfigEntryHtml) {
    var Wizard = Backbone.View.extend({
        className:'modal hide fade',
        template: _.template(ModalHtml),
        events: {
            'click .location-wizard-previous': 'previousStep',
            'click .location-wizard-next': 'nextStep',
            'click .location-wizard-inject': 'inject',
            'click .location-wizard-save': 'save',
            'click .location-wizard-save-and-reset': 'saveAndReset'
        },

        initialize: function () {
            this.type = '';
            this.step = 0;
            this.location = new Location.Model;

            this.steps = [
                {
                    title: 'No locations defined',
                    subtitle: 'You currently have no location to deploy applications to'
                },
                {
                    title: 'Location type',
                    subtitle: 'Select the location type you want to add',
                    view: new LocationType({wizard: this})
                },
                {
                    title: '<%= type %> Location - Configuration',
                    subtitle: 'Required information about your location',
                    view: new LocationConfiguration({wizard: this})
                },
                {
                    title: '<%= type %> Location - Provisioning',
                    subtitle: 'Provisioning information about your location',
                    view: new LocationProvisioning({wizard: this}),
                    actions: [
                        {
                            label: 'Inject in YAML',
                            class: 'location-wizard-inject'
                        },
                        {
                            label: 'Save and add another',
                            class: 'location-wizard-save-and-reset'
                        },
                        {
                            label: 'Save',
                            class: 'location-wizard-save'
                        }
                    ]
                }
            ];
        },

        render: function() {
            this.$el.html(this.template({}));

            this.renderStep();

            return this;
        },

        renderStep: function() {
            var step = this.steps[this.step];

            this.$('.location-wizard-title').html(_.template(step.title)({type: this.capitalize(this.type)}));
            this.$('.location-wizard-subtitle').html(_.template(step.subtitle)({type: this.type}));

            if (_.isObject(step.view)) {
                this.$('.modal-body').html(step.view.render().el);
            }

            // Render prev / next buttons
            var prev =  this.$('.location-wizard-previous');
            var next =  this.$('.location-wizard-next');
            if (this.step == 0) {
                prev.hide();
            } else {
                prev.show();
            }
            if (this.step == this.steps.length - 1) {
                next.hide();
            } else {
                next.show();
            }
            this.$('.trail').html('Step ' + (this.step + 1) + ' of ' + this.steps.length);

            // Render actions buttons
            var actionContainer = this.$('.location-wizard-actions').empty();
            if (_.isArray(step.actions)) {
                _.each(step.actions, function(element, index, list) {
                    actionContainer.append($('<button>').addClass(element.class).html(element.label));
                });
            }
        },

        previousStep: function() {
            if (this.step > 0) {
                this.step--;
                this.renderStep();
            }
        },

        nextStep: function() {
            if (this.step < this.steps.length - 1) {
                this.step++;
                this.renderStep();
                this.enableNextStep(false);
            }
        },

        enableNextStep: function(enabled) {
            if (enabled) {
                this.$('.location-wizard-next').removeAttr('disabled');
            } else {
                this.$('.location-wizard-next').attr('disabled', 'disabled');
            }
        },

        capitalize: function(text) {
            return text && text.charAt(0).toUpperCase() + text.slice(1);
        },

        inject: function() {
            // TODO: Inject YAML location into the composer
        },

        save: function(callback) {
            var that = this;

            var view = this.steps[this.step].view;
            if (view instanceof LocationProvisioning) {
                view.setProvisioningProperties();
            }

            this.location.save()
                .done(function (data) {
                    if (_.isFunction(callback)) {
                        callback();
                    } else {
                        that.$('.close').click();
                    }
                })
                .fail(function (response) {
                    that.showFailure(Util.extractError(response));
                });
        },

        saveAndReset: function() {
            var that = this;
            this.save(function() {
                that.step = 1;
                that.renderStep();
            });
        },

        showFailure: function(text) {
            if (!text) text = "Failure performing the specified action";
            this.$('div.error-message .error-message-text').html(_.escape(text));
            this.$('div.error-message').slideDown(250).delay(10000).slideUp(500);
        }

    });

    var LocationType = Backbone.View.extend({
        className: 'location-wizard-body',
        template: _.template(LocationTypeHtml),
        wizard: null,

        render: function() {
            this.$el.html(this.template({}));

            if (this.options.wizard.type != null) {
                var that = this;
                this.$('.location-type').each(function() {
                    if ($(this).data('type') === that.options.wizard.type) {
                        $(this).addClass('selected');
                        that.options.wizard.enableNextStep(true);
                    }
                });
            }

            var that = this;
            this.$('.location-type').click(function() {
                var type = $(this).data('type');
                $(this).toggleClass('selected');
                that.options.wizard.type = $(this).hasClass('selected') ? type : '';
                that.options.wizard.enableNextStep(that.options.wizard.type !== '');

                that.$('.location-type').each(function() {
                    if ($(this).data('type') != type) {
                        $(this).removeClass('selected');
                    }
                });
            });

            return this;
        }
    });

    var LocationConfiguration = Backbone.View.extend({
        className: 'location-wizard-body',
        template: _.template(LocationConfigurationHtml),
        fields: {
            cloud: [
                {
                    id: 'name',
                    label: 'location ID',
                    type: 'text',
                    require: true
                },
                {
                    id: 'displayName',
                    label: 'location name',
                    type: 'text',
                    require: true
                },
                {
                    id: 'spec',
                    label: 'Cloud type',
                    type: 'select',
                    values: {
                        'jclouds:aws': 'Amazon',
                        'jclouds:softlayer': 'Softlayer',
                        'jclouds:openstack': 'Openstack',
                        other: 'Other'
                    }
                },
                {
                    id: 'region',
                    label: 'Cloud region',
                    type: 'text',
                    require: {
                        spec: [
                            'jclouds:aws', 'jclouds:softlayer'
                        ]
                    },
                    disable: {
                        spec: [
                            'jclouds:openstack'
                        ]
                    }
                },
                {
                    id: 'endpoint',
                    label: 'Cloud endpoint',
                    type: 'text',
                    require: {
                        spec: [
                            'jclouds:openstack'
                        ]
                    },
                    disable: {
                        spec: [
                            'jclouds:aws', 'jclouds:softlayer'
                        ]
                    }
                },
                {
                    id: 'identity',
                    label: 'Identity',
                    type: 'text',
                    require: true
                },
                {
                    id: 'credential',
                    label: 'Credential',
                    type: 'text',
                    require: true
                }
            ],
            localhost: [
                {
                    id: 'name',
                    label: 'location ID',
                    type: 'text',
                    require: true
                },
                {
                    id: 'displayName',
                    label: 'location name',
                    type: 'text',
                    require: true
                },
                {
                    id: 'user',
                    label: 'User',
                    type: 'text'
                },
                {
                    id: 'password',
                    label: 'Password',
                    type: 'password'
                },
                {
                    id: 'publicKeyFile',
                    label: 'Private key',
                    type: 'textarea'
                },
                {
                    id: 'publicKeyPassphrase',
                    label: 'Private key passphrase',
                    type: 'test'
                }
            ],
            byon: [
                {
                    id: 'name',
                    label: 'location ID',
                    type: 'text',
                    require: true
                },
                {
                    id: 'displayName',
                    label: 'location name',
                    type: 'text',
                    require: true
                },
                {
                    id: 'user',
                    label: 'User',
                    type: 'text'
                },
                {
                    id: 'password',
                    label: 'Password',
                    type: 'password'
                },
                {
                    id: 'publicKeyFile',
                    label: 'Private key',
                    type: 'textarea'
                },
                {
                    id: 'publicKeyPassphrase',
                    label: 'Private key passphrase',
                    type: 'test'
                },
                {
                    id: 'hosts',
                    label: 'Hosts',
                    type: 'textarea',
                    list: true,
                    require: true
                }
            ]
        },
        wizard: null,
        type: null,

        render: function() {
            this.$el.html(this.template());

            var that = this;
            var fields = this.fields[this.options.wizard.type];
            _.each(fields, function(field, index) {
                that.$('.tab-content').append(that.generateField(field));
            });

            if (_.contains(['localhost', 'byon'], this.options.wizard.type)) {
                this.options.wizard.location.set('spec', this.options.wizard.type);
            }

            return this;
        },

        generateField: function(field) {
            var that = this;
            var location = this.options.wizard.location;

            var input = $('<input>').attr('type', field.type);
            if (field.type === 'textarea') {
                input = $('<textarea>');
            } else if (field.type === 'select') {
                input = $('<select>');
                _.each(field.values, function(value, key) {
                    input.append($('<option>').attr('value', key).html(value));
                });
            }
            input.data('list', _.isBoolean(field.list) ? field.list : false);
            input.data('require', _.isBoolean(field.require) ? field.require : false);

            // Handle dependencies between fields
            if (_.isObject(field, 'require')) {
                _.each(field.require, function (object, key) {
                    that.$('#' + key).change(function () {
                        that.$('#' + field.id).data('require', _.contains(object, $(this).val()));
                    });
                });
            }

            if (_.isObject(field, 'disable')) {
                _.each(field.disable, function (object, key) {
                    that.$('#' + key).change(function () {
                        if (_.contains(object, $(this).val())) {
                            that.$('#' + field.id).attr('disabled', 'disabled')
                        } else {
                            that.$('#' + field.id).removeAttr('disabled');
                        }
                    });
                });
            }

            var html = $('<div>').addClass('control-group')
                .append($('<label>').addClass('control-label deploy-label').attr('for', field.id).html(field.label))
                .append(input.attr({
                    id: field.id,
                    name: field.id
                }));

            input.change(function() {
                if (_.contains(['name', 'spec'], $(this).attr('name'))) {
                    location.set($(this).attr('name'), $(this).val());
                } else {
                    var config = {};
                    config[$(this).attr('name')] = $(this).data('list') ? $(this).val().split("\n") : $(this).val();
                    location.set('config', _.extend(location.get('config'), config));
                }
                that.checkRequired();
            }).trigger("change");


            return html;
        },

        checkRequired: function() {
            var valid = true;
            this.$('input,textarea').each(function() {
                if ($(this).data('require')) {
                    valid = valid && $(this).val() !== '';
                }
            });

            this.options.wizard.enableNextStep(valid);
        }
    });

    var LocationProvisioning = Backbone.View.extend({
        className: 'location-wizard-body',
        template: _.template(LocationProvisioningHtml),
        events: {
            'click #remove-config': 'removeProvisioningProperty',
            'click #add-config': 'addProvisioningProperty'
        },
        wizard: null,

        render: function() {
            this.$el.html(this.template({}));
            return this;
        },

        setProvisioningProperties: function() {
            var config = {};
            $('.app-add-wizard-config-entry').each(function() {
                config[$(this).find('input[name=key]').val()] = $(this).find('input[name=value]').val();
            });
            this.options.wizard.location.set('config', _.extend(this.options.wizard.location.get('config'), config));
        },

        addProvisioningProperty:function (event) {
            var $row = _.template(EditConfigEntryHtml, {});
            $(event.currentTarget).parent().prev().append($row);
        },

        removeProvisioningProperty:function (event) {
            $(event.currentTarget).parent().parent().remove();
        }
    });

    return Wizard;
});