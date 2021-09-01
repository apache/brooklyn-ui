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
package org.apache.brooklyn.ui.modularity.module.registry;

import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.apache.brooklyn.ui.modularity.module.api.UiModule;
import org.apache.brooklyn.ui.modularity.module.api.UiModuleRegistry;

public class UiModuleRegistryImpl implements UiModuleRegistry {
    private static final Logger LOG = LoggerFactory.getLogger(UiModuleRegistryImpl.class);
    // keyed on UUID (doesn't really matter what)
    // also note the context paths will normally be unique, as even if diff versions of same bundle are installed,
    // only one will have the servlet context initialized and thus only one will normally be available here;
    // however due to asynchronous callback of unregister the register(v2) and unregister(v1) might occur in either order,
    // so we mustn't key on the slug or the context path here!
    private final ConcurrentHashMap<String, UiModule> registry = new ConcurrentHashMap<>();

    public void register(final UiModule uiModule) {
        if (uiModule.getId()==null) {
            LOG.error("Skipping invalid Brooklyn UI module "+uiModule, new Throwable("source of error"));
            return;
        }
        LOG.info("Registering new Brooklyn web component [{}] [{}]", uiModule.getId(), uiModule.getName());
        registry.put(uiModule.getId(), uiModule);
    }

    public void unregister(final UiModule uiModule) {
        if (uiModule != null) {
            LOG.info("Unregistered new Brooklyn web component [{}] [{}]", uiModule.getId(),  uiModule.getName());
            registry.remove(uiModule.getId());
        }
    }

    public Collection<UiModule> getRegisteredModules() {
        return registry.values();
    }
}
