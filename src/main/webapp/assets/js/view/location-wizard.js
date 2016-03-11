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
                    view: LocationType
                },
                {
                    title: '<%= type %> Location - Configuration',
                    subtitle: 'Required information about your location',
                    view: LocationConfiguration
                },
                {
                    title: '<%= type %> Location - Provisioning',
                    subtitle: 'Provisioning information about your location',
                    view: LocationProvisioning
                }
            ];

            this.actions = [
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
                this.currentView = new step.view({wizard: this});
                this.$('.modal-body').html(this.currentView.render().el);
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
            } else if (this.step == this.steps.length - 2 && this.type !== 'cloud') {
                next.hide();
            } else {
                next.show();
            }
            this.$('.trail').html('Step ' + (this.step + 1) + ' of ' + this.steps.length);

            // Render actions buttons
            var actionContainer = this.$('.location-wizard-actions').empty();
            if ((this.type === 'cloud' && this.step === 3) || (this.type !== 'cloud' && this.step === 2)) {
                _.each(this.actions, function(element, index, list) {
                    actionContainer.append($('<button>').addClass('btn btn-mini btn-info ' + element.class).html(element.label));
                });
            }

            this.$('input').first().focus();
        },

        previousStep: function() {
            if (this.step > 0) {
                if (this.currentView) {
                    this.currentView.close();
                }
                this.step--;
                this.renderStep();
            }
        },

        nextStep: function() {
            if (this.step < this.steps.length - 1) {
                if (this.currentView) {
                    this.currentView.close();
                }
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
        events: {
            'click .location-type': 'onSelectType'
        },

        wizard: null,

        initialize: function() {
            this.wizard = this.options.wizard;
        },

        render: function() {
            this.$el.html(this.template());

            var that = this;
            this.$('.location-type').each(function () {
                if ($(this).data('type') === that.wizard.type) {
                    $(this).addClass('selected');
                    that.wizard.enableNextStep(true);
                }
            });

            return this;
        },

        onSelectType: function(event) {
            var $elm = this.$(event.currentTarget);
            var type = $elm.data('type');

            $elm.toggleClass('selected');
            this.wizard.type = $elm.hasClass('selected') ? type : '';
            this.wizard.enableNextStep(this.wizard.type !== '');

            if (this.wizard.location.get('spec') !== this.wizard.type) {
                this.wizard.location = new Location.Model;
            }

            this.$('.location-type').each(function() {
                if ($(this).data('type') != type) {
                    $(this).removeClass('selected');
                }
            });

            return this;
        }
    });

    var LocationConfiguration = Backbone.View.extend({
        className: 'location-wizard-body',
        template: _.template(LocationConfigurationHtml),
        events: {
            'blur input, textarea': 'onChange',
            'change select': 'onChange'
        },

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
                        'jclouds:aws-ec2': 'Amazon',
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
                            'jclouds:aws-ec2', 'jclouds:softlayer'
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
                            'jclouds:aws-ec2', 'jclouds:softlayer'
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

        initialize: function() {
            this.wizard = this.options.wizard;

            if (_.contains(['localhost', 'byon'], this.wizard.type)) {
                this.wizard.location.set('spec', this.wizard.type);
            }
        },

        render: function() {
            this.$el.html(this.template());

            var that = this;
            var fields = this.fields[this.wizard.type];
            _.each(fields, function(field, index) {
                that.$('.tab-content').append(that.generateField(field));
            });

            // Force the onChange event to run
            this.$('input,textarea').blur();
            this.$('select').change();

            return this;
        },

        generateField: function(field) {
            var input = $('<input>').attr('type', field.type);
            if (field.type === 'textarea') {
                input = $('<textarea>');
            } else if (field.type === 'select') {
                input = $('<select>');
                _.each(field.values, function(value, key) {
                    input.append($('<option>').attr('value', key).html(value));
                });
            }

            var value = '';
            if (_.contains(['name', 'spec'], field.id)) {
                value = this.wizard.location.get(field.id);
            } else {
                value = this.wizard.location.get('config')[field.id];
            }

            return $('<div>').addClass('control-group')
                .append($('<label>')
                    .addClass('control-label deploy-label')
                    .attr('for', field.id)
                    .html(field.label))
                .append(input
                    .val(value)
                    .data('list', _.isBoolean(field.list) ? field.list : false)
                    .data('require', _.isBoolean(field.require) ? field.require : false)
                    .data('require-deps', _.isObject(field.require) ? field.require : undefined)
                    .data('disable-deps', _.isObject(field.disable) ? field.disable : undefined)
                    .attr({
                        id: field.id,
                        name: field.id
                    }));
        },

        onChange: function(event) {
            var that = this;
            var enable = true;
            var $elm = this.$(event.currentTarget);

            // Update the location object based on the field values
            if (_.contains(['name', 'spec'], $elm.attr('name'))) {
                this.wizard.location.set($elm.attr('name'), $elm.val());
            } else {
                var config = {};
                config[$elm.attr('name')] = $elm.data('list') ? $elm.val().split("\n") : $elm.val();
                this.wizard.location.set('config', _.extend(this.wizard.location.get('config'), config));
            }

            this.$('input, select, textarea').each(function() {
                // Update the data-require attribute
                if (_.isObject($(this).data('require-deps'))) {
                    var require = true;
                    _.each($(this).data('require-deps'), function(values, key) {
                        require = require && _.contains(values, that.$('[name=' + key + ']').val());
                    });
                    $(this).data('require', require);
                }

                // Enable / disable field
                if (_.isObject($(this).data('disable-deps'))) {
                    var disable = true;
                    _.each($(this).data('disable-deps'), function(values, key) {
                        disable = disable && _.contains(values, that.$('[name=' + key + ']').val());
                    });
                    if (disable) {
                        $(this).attr('disabled', 'disabled');
                    } else {
                        $(this).removeAttr('disabled');
                    }
                }


                // Enable / disable next button based on the require attribute
                if ($(this).data('require')) {
                    enable = enable && $(this).val() !== '';
                }
                that.wizard.enableNextStep(enable);
            });
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

        initialize: function() {
            this.wizard = this.options.wizard;
        },

        render: function() {
            this.$el.html(this.template());
            return this;
        },

        setProvisioningProperties: function() {
            var config = {};
            this.$('.app-add-wizard-config-entry').each(function() {
                config[$(this).find('input[name=key]').val()] = $(this).find('input[name=value]').val();
            });
            this.wizard.location.set('config', _.extend(this.wizard.location.get('config'), config));
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