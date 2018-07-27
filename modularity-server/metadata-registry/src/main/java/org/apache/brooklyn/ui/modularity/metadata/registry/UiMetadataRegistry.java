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
package org.apache.brooklyn.ui.modularity.metadata.registry;

import java.util.Map;

public interface UiMetadataRegistry {
    String METADATA_TYPE = "type";
    String METADATA_ID = "id";
    String METADATA_TYPE_DEFAULT = "generic";

    void registerMetadata(final String type, final String id, final Map<String, String> metadata);

    void modifyMetadata(final String type, final String id, final Map<String, String> metadata);

    void unregisterMetadata(final String type, final String id);

    Map<String,Map<String,String>> getById(final String id);

    Map<String, Map<String, String>> getByType(final String type);

    Map<String, String> getByTypeAndId(final String type, final String id);

    Map<String, Map<String, Map<String, String>>> getAll();
}
