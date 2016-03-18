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
    var _YAML_HEADER = [
        'brooklyn.catalog:',
        '  version: 0.0.1',
        '  items:'
    ];

    var Wizard = Backbone.View.extend({
        template: _.template(ModalHtml),
        events: {
            'click .location-wizard-previous': 'previousStep',
            'click .location-wizard-next': 'nextStep',
            'click .location-wizard-edit': 'edit',
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
                    title: 'Location Type',
                    subtitle: 'Select the location type to make available for deployments',
                    view: LocationType
                },
                {
                    title: '<%= type %> Location - Configuration',
                    view: LocationConfiguration
                },
                {
                    title: '<%= type %> Location - Provisioning',
                    subtitle: 'In many target locations, additional configuration may be supported. Enter any such options here. For information on available options consult the <a href="https://brooklyn.apache.org/v/latest/ops/locations/">Brooklyn documentation</a>. Alternatively you can skip this step.',
                    view: LocationProvisioning
                }
            ];

            this.actions = [
                {
                    label: 'Edit in YAML',
                    class: 'location-wizard-edit'
                },
                {
                    label: 'Save and Add Another',
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
            if (_.has(step, 'subtitle')) {
                this.$('.location-wizard-subtitle').html(_.template(step.subtitle)({type: this.type})).show();
            } else {
                this.$('.location-wizard-subtitle').hide();
            }

            // Render actions buttons
            var actionContainer = this.$('.location-wizard-actions').empty();
            if (this.step === 2 || (this.type === 'byon' && this.step === 1)) {
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
            } else if (this.step == this.steps.length - 2 && this.type === 'byon') {
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

        edit: function() {
            if (this.currentView instanceof LocationProvisioning) {
                this.currentView.setProvisioningProperties();
            }

            var baseSpacing = '  ';

            var content = [].concat(_YAML_HEADER);

            content.push(baseSpacing + '- id: ' + this.location.get('name'));

            baseSpacing += '  ';
            content.push(baseSpacing + 'itemType: location');
            content.push(baseSpacing + 'item:');

            baseSpacing += '  ';
            content.push(baseSpacing + 'type: ' + this.location.get('spec'));

            var config = this.location.get('config');
            if (_.keys(config).length > 0) {
                content.push(baseSpacing + 'brooklyn.config:');
                baseSpacing += '  ';

                _.each(config, function(value, key) {
                    if (_.isArray(value)) {
                        content.push(baseSpacing + key + ':');
                        _.each(value, function(valueValue) {
                            content.push(baseSpacing + '- ' + valueValue);
                        });
                    } else if (_.isObject(value)) {
                        content.push(baseSpacing + key + ':');
                        _.each(value, function(valueValue, valueKey) {
                            content.push(baseSpacing + '  ' + valueKey + ': ' + valueValue);
                        });
                    } else {
                        content.push(baseSpacing + key + ': ' + value);
                    }
                });
            }

            Backbone.history.navigate("/v1/editor/catalog/_/"+ encodeURIComponent(content.join("\n")), {trigger: true});
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
            'mouseenter .location-type': 'onDisplayHelp',
            'mouseleave .location-type': 'onHideHelp',
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

        onDisplayHelp: function(event) {
            var $elm = this.$(event.currentTarget);
            this.$('.help-text').html($elm.data('help')).show();
        },

        onHideHelp: function(event) {
            this.$('.help-text').html('').hide();
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

    var common_fields = {
        location_id: {
            id: 'name',
            label: 'Location ID',
            type: 'text',
            help: 'A label to identify this location in YAML. Typically this is lower case using hyphens and no spaces',
            require: true
        },
        location_name: {
            id: 'displayName',
            label: 'Location Name',
            type: 'text',
            help: 'A display name to present this location to a user (optional)'
        },
    };
    
    var LocationConfiguration = Backbone.View.extend({
        className: 'location-wizard-body',
        template: _.template(LocationConfigurationHtml),
        events: {
            'blur input, textarea': 'onChange',
            'change select': 'onChange'
        },

        fields: {
            cloud: [
                common_fields.location_id,
                common_fields.location_name,
                {
                    id: 'spec',
                    label: 'Cloud Provider',
                    type: 'select',
                    values: {
                        'jclouds:aws-ec2': 'Amazon',
                        'jclouds:google-compute-engine': 'Google',
                        'jclouds:openstack': 'Openstack',
                        'jclouds:softlayer': 'Softlayer',
                        other: 'Other (supply location spec string)'
                    }
                },
                {
                    id: 'region',
                    label: 'Cloud Region',
                    type: 'text',
                    help: 'Public cloud providers often have multiple regions available. Enter the region to use if applicable (optional)',
                    disable: {
                        spec: [
                            'jclouds:openstack'
                        ]
                    }
                },
                {
                    id: 'endpoint',
                    label: 'Cloud Endpoint',
                    type: 'text',
                    help: 'If using a private cloud, the URL to connect to it is required',
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
                    label: 'Cloud Identity',
                    type: 'text',
                    help: 'The account name or access key to log in to this cloud',
                    require: true
                },
                {
                    id: 'credential',
                    label: 'Cloud Credential',
                    help: 'The password or secret key for the Cloud Identity to log in to this cloud',
                    type: 'text',
                    require: true
                }
            ],
            byon: [
                common_fields.location_id,
                common_fields.location_name,
                {
                    id: 'user',
                    label: 'User',
                    type: 'text',
                    help: 'The user to use to connect to the machines. One of the following two fields must also be supplied to connect'
                },
                {
                    id: 'password',
                    label: 'Password',
                    type: 'password',
                    help: 'The password to use to connect to the machines (if using password access)'
                },
                {
                    id: 'privateKeyFile',
                    label: 'Private Key Data',
                    type: 'textarea',
                    help: 'The contents of the private key file to use to connect to the machines (if using key access, where the corresponding public key is in the <code>.authorized_keys</code> file on the servers)'
                },
                {
                    id: 'privateKeyPassphrase',
                    label: 'Private Key Passphrase',
                    type: 'text',
                    help: 'The passphrase to unlock the private key specified above (if applicable)'
                },
                {
                    id: 'hosts',
                    label: 'Hosts',
                    type: 'textarea',
                    help: 'The IP addresses of the machines to include in this location definition, one per line',
                    list: true,
                    require: true
                }
            ],
            advanced: [
                common_fields.location_id,
                common_fields.location_name,
                {
                    id: 'spec',
                    label: 'Parent Location',
                    type: 'text',
                    help: 'The identity or spec of the location which this location should extend',
                    require: true
                }
            ]
        },
        wizard: null,

        initialize: function() {
            this.wizard = this.options.wizard;

            if (this.wizard.type === 'byon') {
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
            var $input = $('<input>').attr('type', field.type);
            if (field.type === 'textarea') {
                $input = $('<textarea>');
            } else if (field.type === 'select') {
                $input = $('<select>');
                _.each(field.values, function(value, key) {
                    $input.append($('<option>').attr('value', key).html(value));
                });
                $('<input>').attr('name', field.id + '-other').insertAfter($input);
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
                .append($input
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

            if (_.has(field, 'help')) {
                $div.append($('<p>').addClass('help-block').html($('<small>').html(field.help)));
            }

            if (field.type === 'text' && field.id === 'spec') {
                var locations = new Location.Collection;
                locations.fetch({
                    success: function (model) {
                        $input.easyAutocomplete({
                            list: {
                                match: {
                                    enabled: true
                                }
                            },
                            categories: [
                                {
                                    listLocation: 'catalog',
                                    header: 'Catalog Locations'
                                },
                                {
                                    listLocation: 'spec',
                                    header: 'Spec'
                                }
                            ],
                            data: {
                                catalog: _.map(model.models, function(item) {
                                    return item.getIdentifierName();
                                }),
                                spec: ['localhost']
                            }
                        });
                    }
                });
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
                        $(this).attr('disabled', 'disabled').val('');
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