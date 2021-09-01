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

import com.google.common.collect.HashBasedTable;
import com.google.common.collect.Table;
import org.apache.brooklyn.ui.modularity.metadata.registry.UiMetadataRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

public class UiMetadataRegistryImpl implements UiMetadataRegistry {
    private static final Logger logger = LoggerFactory.getLogger(UiMetadataRegistryImpl.class);

    final Table<String, String, Map<String, String>> metadataTable = HashBasedTable.create();

    @Override
    public void registerMetadata(final String type, final String id, final Map<String, String> metadata) {
        modifyMetadata(type, id, metadata);
    }

    @Override
    public void modifyMetadata(final String type, final String id, final Map<String, String> metadata) {
        metadataTable.put(type, id, metadata);
    }

    @Override
    public void unregisterMetadata(final String type, final String id) {
        metadataTable.remove(type, id);
    }

    @Override
    public Map<String, Map<String, String>> getById(final String id) {
        return metadataTable.column(id);
    }

    @Override
    public Map<String, Map<String, String>> getByType(final String type) {
        return metadataTable.row(type);
    }

    @Override
    public Map<String, String> getByTypeAndId(final String type, final String id) {
        return metadataTable.get(type, id);
    }

    @Override
    public Map<String, Map<String, Map<String, String>>> getAll() {
        return metadataTable.rowMap();
    }
}
