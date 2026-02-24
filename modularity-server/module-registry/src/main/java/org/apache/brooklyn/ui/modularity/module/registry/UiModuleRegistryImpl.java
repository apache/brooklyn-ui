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

import com.google.common.io.CharStreams;
import org.apache.brooklyn.ui.modularity.module.api.UiModule;
import org.apache.brooklyn.ui.modularity.module.api.UiModuleRegistry;
import org.apache.brooklyn.ui.modularity.module.api.internal.UiModuleImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.events.Event;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.nio.charset.Charset;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

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
        if (isExcluded(uiModule)) {
            LOG.info("Brooklyn web component [{}] [{}] is excluded from the registry in this deployment", uiModule.getId(), uiModule.getName());
        } else {
            LOG.info("Registering new Brooklyn web component [{}] [{}]", uiModule.getId(), uiModule.getName());
            registry.put(uiModule.getId(), uiModule);
        }
    }

    Map brooklynUiCfg;
    public boolean isExcluded(UiModule uiModule) {
        InputStream s = null;
        try {
            s = new URL("file:etc/brooklyn-ui.cfg").openStream();
            if (s==null) return false;
        } catch (IOException e) {
            LOG.trace("No brooklyn-ui.cfg found. Module settings will use defaults.");
        }
        try {
            if (brooklynUiCfg==null) {
                brooklynUiCfg = new Yaml().load(s);
                if (brooklynUiCfg==null) brooklynUiCfg = Collections.emptyMap();
            }
            String bundleId = uiModule.getBundleId();

            if (bundleId==null) {
                Boolean excludeNull = (Boolean) brooklynUiCfg.get("exclude_bundle_unset");
                if (excludeNull == null) return false;
                return excludeNull;
            } else {
                List<String> exclusions = (List<String>) brooklynUiCfg.get("exclude_bundle_regex");
                if (exclusions != null) {
                    for (String ex : exclusions) {
                        if (bundleId.matches(ex)) return true;
                    }
                }
            }
        } catch (Exception e) {
            LOG.warn("Invalid brooklyn-ui.cfg (ignoring): "+e, e);
            if (brooklynUiCfg==null) brooklynUiCfg = Collections.emptyMap();
        }
        return false;
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
