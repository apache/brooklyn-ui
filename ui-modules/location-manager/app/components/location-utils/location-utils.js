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
import angular from 'angular';

const MODULE_NAME = 'br.utils.location-utils';

angular.module(MODULE_NAME, [])
    .provider('locationConfig', locationConfigProvider)
    .provider('locationSpec', locationSpecProvider)
    .filter('locationIcon', ['locationSpec', locationIconFilter])
    .filter('locationName', locationNameFilter)
    .filter('locationProviderUrl', ['locationSpec', locationProviderUrlFilter]);

export default MODULE_NAME;

export function locationConfigProvider() {
    return {
        $get: [LocationConfigFactory]
    };

    function LocationConfigFactory() {
        return {
            'minCore': {
                description: 'Minimum number of cores for the generated VM',
                type: 'number'
            },
            'minRam': {
                description: 'Minimum amount of RAM for the generated VM',
                type: 'number',
                unit: 'Mb'
            },
            'osFamily': {
                description: 'Operating system to use for the generated VM',
                type: 'select',
                options: {
                    'ubuntu': 'Ubuntu',
                    'centos': 'CentOS',
                    'redhat': 'Red Hat',
                    'windows': 'Windows',
                }
            },
            'osVersionRegex': {
                description: 'Operating system\'s version to use for the generated VM',
                type: 'text'
            },
            'os64Bit': {
                description: 'Use a 64-bit operating system',
                type: 'checkbox'
            },
            'imageId': {
                description: 'Image ID to use for the generated VM',
                type: 'text'
            },
            'imageNameRegex': {
                description: 'Regular expression to choose an image for the generated VM',
                type: 'text'
            },
            'hardwareId': {
                description: 'Hardware ID to use for the generated VM',
                type: 'text'
            },
            'inboundPorts': {
                description: 'Ports to open for inbound connections, separated by a comma',
                type: 'text'
            },
            'securityGroups': {
                description: 'Security groups to use the generated VM, separated by a comma',
                type: 'text'
            },
            'domainName': {
                description: 'Domain name to use for the generated VM',
                type: 'text'
            },
            'userMetadata': {
                description: 'Metadata to set on the generated VM',
                type: 'text'
            },
            'machineCreateAttempts': {
                description: 'Maximum number of retries when attemting to create a VM',
                type: 'number'
            },
            'destroyOnFailure': {
                description: 'Whether or not to destroy the VM if provisioning fails',
                type: 'checkbox'
            },
            'user': {
                description: 'Operating user created on provisioned VM',
                type: 'text'
            },
            'password': {
                description: 'Operating user\'s password created on provisioned VM',
                type: 'password'
            },
            'loginUser': {
                description: 'Initial user to log in as',
                type: 'text'
            },
            'privateKeyFile': {
                description: 'Path to private key to use to connect to the provisioned VM',
                type: 'text'
            },
            'privateKeyPassphrase': {
                description: 'Passphrase to open the SSH key, used to connect to the provisioned VM',
                type: 'text'
            },
            'publicKeyFile': {
                description: 'Path to public key to use to connect to the provisioned VM',
                type: 'text'
            },
            'openIptables': {
                description: 'Whether or not automatically configure iptables',
                type: 'checkbox'
            },
            'installDevUrandom': {
                description: 'Whether or not install urandom',
                type: 'checkbox'
            },
            'useJcloudsSshInit': {
                description: 'Whether or not disable the native jclouds support for initial commands executed on the VM',
                type: 'checkbox'
            }
        };
    }
}

export function locationSpecProvider() {
    return {
        $get: [LocationSpecFactory]
    };

    function LocationSpecFactory() {
        return {
            'jclouds:aws-ec2': {
                name: 'Amazon EC2',
                url: 'https://aws.amazon.com/console/',
                icon: require('../../img/location-icons/aws.png')
            },
            'jclouds:softlayer': {
                name: 'Softlayer',
                url: 'https://control.softlayer.com/',
                icon: require('../../img/location-icons/softlayer.png')
            },
            'jclouds:google-compute-engine': {
                name: 'Google Compute Engine',
                url: 'https://console.cloud.google.com/start',
                icon: require('../../img/location-icons/jclouds-google-compute-engine.png')
            },
            'jclouds:openstack-nova': {
                name: 'Openstack Nova',
                icon: require('../../img/location-icons/jclouds-openstack-nova.png')
            },
            'jclouds:openstack-mitaka-nova': {
                name: 'Openstack Mitaka',
                icon: require('../../img/location-icons/jclouds-openstack-nova.png')
            },
            'jclouds:azurecompute-arm': {
                name: 'Microsoft Azure ARM',
                url: 'https://portal.azure.com/',
                icon: require('../../img/location-icons/azurecompute-arm.png')
            },
            'jclouds:azurecompute': {
                name: 'Microsoft Azure Classic (Deprecated)',
                url: 'https://portal.azure.com/',
                icon: require('../../img/location-icons/azurecompute.png')
            },
            'localhost': {
                name: 'Localhost',
                url: 'https://localhost/',
                icon: require('../../img/location-icons/localhost.png')
            },
            'byon': {
                name: 'BYON',
                icon: require('../../img/location-icons/byon.png')
            }
        }
    }
}

export function locationIconFilter(locationSpecProvider) {
    return function (input) {
        if (input.iconUrl) {
            return input.iconUrl;
        }
        if (locationSpecProvider.hasOwnProperty(input.spec) && locationSpecProvider[input.spec].icon) {
            return locationSpecProvider[input.spec].icon;
        }
        return require('../../img/location-icons/cloud.png');
    }
}

export function locationNameFilter() {
    return function(input) {
        if (!input) {
            return null;
        }
        if (input.config && input.config.hasOwnProperty('name')) {
            return input.config.name;
        }
        return input.name ? input.name : input.symbolicName;
    }
}

export function locationProviderUrlFilter(locationSpecProvider) {
    return function(input) {
        return locationSpecProvider.hasOwnProperty(input.spec) ? locationSpecProvider[input.spec].url : '#';
    }
}
