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
    'underscore', 'backbone', 'jquery',
    'brooklyn-utils', 'model/location',
    'text!tpl/location-wizard/modal.html',
    'text!tpl/location-wizard/location-type.html',
    'text!tpl/location-wizard/location-configuration.html',
    'text!tpl/location-wizard/location-provisioning.html',
    'text!tpl/location-wizard/location-provisioning-entry.html',

    'jquery-easy-autocomplete'
], function(_, Backbone, $, Util, Location, ModalHtml, LocationTypeHtml, LocationConfigurationHtml, LocationProvisioningHtml, LocationProvisioningEntry) {
    var Wizard = Backbone.View.extend({
        template: _.template(ModalHtml),
        events: {
            'click .location-wizard-previous': 'previousStep',
            'click .location-wizard-next': 'nextStep',
            'click .location-wizard-save': 'save',
            'click .location-wizard-save-and-reset': 'saveAndReset'
        },

        initialize: function () {
            this.type = '';
            this.step = 0;
            this.location = new Location.Model;
            this.onLocationCreated = _.isFunction(this.options.onLocationCreated) ? this.options.onLocationCreated : undefined;
            this.onFinish = _.isFunction(this.options.onFinish) ? this.options.onFinish : undefined;
            this.className = _.isBoolean(this.options.isModal) && this.options.isModal ? 'modal hide fade' : '';

            this.steps = [
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
            this.$el.addClass(this.className).html(this.template({}));

            this.renderStep();

            return this;
        },

        renderStep: function() {
            var step = this.steps[this.step];

            this.$('.location-wizard-title').html(_.template(step.title)({type: this.capitalize(this.type)}));
            this.$('.location-wizard-subtitle').html(_.template(step.subtitle)({type: this.type}));

            // Render actions buttons
            var actionContainer = this.$('.location-wizard-actions').empty();
            if ((this.type === 'cloud' && this.step === 2) || (this.type !== 'cloud' && this.step === 1)) {
                _.each(this.actions, function(element, index, list) {
                    actionContainer.append($('<button>').addClass('btn btn-mini btn-info location-wizard-action ' + element.class).html(element.label));
                });
            }

            if (this.currentView) {
                this.currentView.close();
            }

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

            this.$('input').first().focus();
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
            }
        },

        enableNextAction: function(enabled) {
            if (enabled) {
                this.$('.location-wizard-action').removeAttr('disabled');
            } else {
                this.$('.location-wizard-action').attr('disabled', 'disabled');
            }
        },

        capitalize: function(text) {
            return text && text.charAt(0).toUpperCase() + text.slice(1);
        },

        save: function(callback) {
            var that = this;

            if (this.currentView instanceof LocationProvisioning) {
                this.currentView.setProvisioningProperties();
            }

            this.location.save()
                .done(function (data) {
                    if (_.isFunction(that.onLocationCreated)) {
                        that.onLocationCreated(that, data);
                    }

                    if (_.isFunction(callback)) {
                        callback();
                    } else if (_.isFunction(that.onFinish)) {
                        that.onFinish(that, data);
                    }
                })
                .fail(function (response) {
                    that.showFailure(Util.extractError(response));
                });
        },

        saveAndReset: function() {
            var that = this;
            this.save(function() {
                that.step = 0;
                that.type = '';
                that.location = new Location.Model;
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

            this.wizard.enableNextAction(false);

            var that = this;
            this.$('.location-type').each(function () {
                if ($(this).data('type') === that.wizard.type) {
                    $(this).addClass('selected');
                    that.wizard.enableNextAction(true);
                }
            });

            return this;
        },

        onSelectType: function(event) {
            var $elm = this.$(event.currentTarget);
            var type = $elm.data('type');

            $elm.toggleClass('selected');
            this.wizard.type = $elm.hasClass('selected') ? type : '';
            this.wizard.enableNextAction(this.wizard.type !== '');

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
                        'jclouds:google-compute-engine': 'Google',
                        'jclouds:openstack': 'Openstack',
                        'jclouds:softlayer': 'Softlayer',
                        other: 'Other'
                    }
                },
                {
                    id: 'region',
                    label: 'Cloud region',
                    type: 'text',
                    require: {
                        spec: [
                            'jclouds:aws-ec2', 'jclouds:google-compute-engine', 'jclouds:softlayer'
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
                    id: 'privateKeyFile',
                    label: 'Private key',
                    type: 'textarea'
                },
                {
                    id: 'privateKeyPassphrase',
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
                    id: 'privateKeyFile',
                    label: 'Private key',
                    type: 'textarea'
                },
                {
                    id: 'privateKeyPassphrase',
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

            this.wizard.enableNextAction(false);

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
                $('<input>').attr('name', field.id + '-other').insertAfter(input);
            }

            var value = '';
            if (_.contains(['name', 'spec'], field.id)) {
                value = this.wizard.location.get(field.id);
            } else {
                value = this.wizard.location.get('config')[field.id];
            }

            var $div =  $('<div>').addClass('control-group')
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

            if (field.type === 'select' && _.has(field.values, 'other')) {
                $div.append($('<input>')
                    .attr('name', field.id + '-other')
                    .addClass('location-other')
                    .hide());
            }

            return $div;
        },

        onChange: function(event) {
            var that = this;
            var enable = true;
            var $elm = this.$(event.currentTarget);

            if ($elm.attr('name') === 'spec') {
                if ($elm.val() === 'other') {
                    this.$('input[name=spec-other]').show();
                } else {
                    this.$('input[name=spec-other]').hide();
                }
            }

            // Update the location object based on the field values
            if ($elm.val() !== '') {
                if (_.contains(['name', 'spec'], $elm.attr('name'))) {
                    this.wizard.location.set($elm.attr('name'), $elm.val());
                } else if ($elm.attr('name') === 'spec-other') {
                    this.wizard.location.set('spec', $elm.val());
                } else {
                    var config = {};
                    config[$elm.attr('name')] = $elm.data('list') ? $elm.val().split("\n") : $elm.val();
                    this.wizard.location.set('config', _.extend(this.wizard.location.get('config'), config));
                }
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
                that.wizard.enableNextAction(enable);
            });
        }
    });

    var LocationProvisioning = Backbone.View.extend({
        className: 'location-wizard-body',
        template: _.template(LocationProvisioningHtml),
        events: {
            'click .remove-entry': 'removeEntry',
            'click .add-entry': 'addEntry'
        },
        wizard: null,

        vmOptions: [
            'minCore',
            'minRam',
            'osFamily',
            'osVersionRegex',
            'os64Bit',
            'imageId',
            'imageNameRegex',
            'hardwareId',
            'inboundPorts',
            'securityGroups',
            'domainName',
            'userMetadata',
            'machineCreateAttempts',
            'destroyOnFailure'
        ],
        osOptions: [
            'user',
            'password',
            'loginUser',
            'privateKeyFile',
            'privateKeyPassphrase',
            'publicKeyFile',
            'openIptables',
            'installDevUrandom',
            'useJcloudsSshInit'

        ],
        templateOptions: [
            'subnetId',
            'mapNewVolumeToDeviceName',
            'securityGroupIds'
        ],

        initialize: function() {
            this.wizard = this.options.wizard;
        },

        render: function() {
            this.$el.html(this.template());
            this.wizard.enableNextAction(true);
            return this;
        },

        setProvisioningProperties: function() {
            var config = {};
            this.$('.control-group').each(function() {
                if ($(this).find('input.entry-key').val() !== '' && $(this).find('input.entry-value').val() !== '') {
                    config[$(this).find('input.entry-key').val()] = $(this).find('input.entry-value').val();
                }
            });
            this.wizard.location.set('config', _.extend(this.wizard.location.get('config'), config));
        },

        addEntry:function (event) {
            var that = this;
            var $entry = $(_.template(LocationProvisioningEntry, {}));
            $(event.currentTarget).prev().append($entry);

            setTimeout(function() {
                $entry.find('input.entry-key').easyAutocomplete({
                    list: {
                        match: {
                            enabled: true
                        }
                    },
                    categories: [
                        {
                            listLocation: 'vmOptions',
                            header: 'VM Creation'
                        },
                        {
                            listLocation: 'osOptions',
                            header: 'OS Setup'
                        },
                        {
                            listLocation: 'templateOptions',
                            header: 'Template Options'
                        }
                    ],
                    data: {
                        vmOptions: that.vmOptions,
                        osOptions: that.osOptions,
                        templateOptions: that.templateOptions
                    }
                });
            }, 100);
        },

        removeEntry:function (event) {
            $(event.currentTarget).parent().remove();
        }
    });

    return Wizard;
});