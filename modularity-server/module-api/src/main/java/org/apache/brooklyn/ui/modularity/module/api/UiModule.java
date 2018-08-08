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
package org.apache.brooklyn.ui.modularity.module.api;

import java.util.List;
import java.util.Set;

public interface UiModule {
    String DEFAULT_ICON = "fa-cogs";

    /**
     * @return The unique ID of the module
     */
    String getId();

    /**
     * @return The module name
     */
    String getName();

    /**
     * @return The human readable id in form (part1-part2-part3...)
     */
    String getSlug();

    /**
     * @return The icon to be used for the module
     */
    String getIcon();

    /**
     * @return The module types eg single-page-app, external-ui
     */
    Set<String> getTypes();
    
    /**
     * @return List of "bundle-regex" or "bundle-regex:version-regex" of bundles that should be stopped when this is installed.
     * Useful if supplying a bundle to replace other bundles.
     */
    Set<String> getSupersedesBundles();

    /**
     * @return Whether to web-stop any bundles listening on the same endpoint. 
     */
    boolean getStopExisting();
    
    /**
     * @return The module path
     */
    String getPath();

    /**
     * @return Registered module actions
     */
    List<UiModuleAction> getActions();
}
