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
/* File where brands can provide JS extensions available as angular modules.
 * If supplied, they must supply all elements declared by the stock Brooklyn implementation.
 * It can be omitted from a brand.
 *
 * The entries returned by the `brBrandInfoProvider` here can be accessed in `brBrandInfo` by passing that module to an angular module.
 */
import angular from 'angular';

export const MODULE_NAME = 'brooklyn.brand.extensionPoint.angularJs';

export default MODULE_NAME;

// This module is loaded last on all Brooklyn UI modules. That means downstream project
// can override it to perform any customization to providers, services, router states, decorators, etc.
angular.module(MODULE_NAME, []);
