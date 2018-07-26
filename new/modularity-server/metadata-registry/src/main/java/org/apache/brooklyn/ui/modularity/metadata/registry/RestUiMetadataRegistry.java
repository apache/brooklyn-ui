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

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import java.util.Map;

@Path("/")
public class RestUiMetadataRegistry {
    private static final Logger logger = LoggerFactory.getLogger(RestUiMetadataRegistry.class);

    private UiMetadataRegistry metadataRegistry;

    @GET
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.APPLICATION_JSON)
    public Map get(
            @QueryParam("id") final String id, @QueryParam("type") final String type) {
        if (StringUtils.isNotEmpty(id) && StringUtils.isNotEmpty(type)) {
            return metadataRegistry.getByTypeAndId(type, id);
        } else if (StringUtils.isNotEmpty(id)) {
            return metadataRegistry.getById(id);
        } else if (StringUtils.isNotEmpty(type)) {
            return metadataRegistry.getByType(type);
        }
        return metadataRegistry.getAll();
    }

    public void setMetadataRegistry(UiMetadataRegistry metadataRegistry) {
        this.metadataRegistry = metadataRegistry;
    }


}
