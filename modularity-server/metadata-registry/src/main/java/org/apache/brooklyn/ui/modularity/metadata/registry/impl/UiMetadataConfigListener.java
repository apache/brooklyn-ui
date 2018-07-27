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
package org.apache.brooklyn.ui.modularity.metadata.registry.impl;

import com.google.common.collect.Maps;
import org.apache.brooklyn.ui.modularity.metadata.registry.UiMetadataRegistry;
import org.osgi.service.component.annotations.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static com.google.common.base.Predicates.in;
import static com.google.common.base.Predicates.not;

@Component(
        name = "Brooklyn UI Metadata",
        configurationPid = UiMetadataConfigListener.PID, configurationPolicy = ConfigurationPolicy.REQUIRE, immediate = true,
        property = {UiMetadataRegistry.METADATA_TYPE + ":String=" + UiMetadataRegistry.METADATA_TYPE_DEFAULT}
)
public class UiMetadataConfigListener {
    static final String PID = "org.apache.brooklyn.ui.metadata";
    private static final Logger logger = LoggerFactory.getLogger(UiMetadataConfigListener.class);
    private static final List<String> EXCLUDE = Arrays.asList(
            "felix.fileinstall.filename", "service.factoryPid", "component.name", "component.id"
    );

    @Reference
    private UiMetadataRegistry metadataRegistry;

    @Activate
    public void activate(final Map<String, String> properties) {
        modified(properties);
    }

    @Modified
    public void modified(final Map<String, String> properties) {
        metadataRegistry.modifyMetadata(
                properties.containsKey(UiMetadataRegistry.METADATA_TYPE) ?
                        properties.get(UiMetadataRegistry.METADATA_TYPE) : UiMetadataRegistry.METADATA_TYPE_DEFAULT,
                properties.containsKey(UiMetadataRegistry.METADATA_ID) ?
                        properties.get(UiMetadataRegistry.METADATA_ID) : properties.get("service.pid"),
                Maps.filterKeys(properties, not(in(EXCLUDE)))
        );
    }
    
    @Deactivate
    public void deactivate(final Map<String, String> properties) {
        metadataRegistry.unregisterMetadata(
                properties.containsKey(UiMetadataRegistry.METADATA_TYPE) ?
                        properties.get(UiMetadataRegistry.METADATA_TYPE) : UiMetadataRegistry.METADATA_TYPE_DEFAULT,
                properties.containsKey(UiMetadataRegistry.METADATA_ID) ?
                        properties.get(UiMetadataRegistry.METADATA_ID) : properties.get("service.pid"));
    }
}
