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
package org.apache.brooklyn.ui.modularity;

import java.util.Arrays;
import java.util.Dictionary;
import java.util.Hashtable;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.brooklyn.ui.modularity.module.api.UiModule;
import org.apache.brooklyn.ui.modularity.module.api.UiModuleAction;
import org.apache.brooklyn.util.collections.MutableList;
import org.apache.brooklyn.util.collections.MutableSet;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.ConfigurationPolicy;
import org.osgi.service.component.annotations.Modified;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.common.collect.ImmutableList;

@Component(
        // name = ExternalUiModule.PID,  // omitting the name / using default seems to prevent warning about it being unable to be installed?
        configurationPid = ExternalUiModule.PID,
        configurationPolicy = ConfigurationPolicy.REQUIRE,  // only trigger if there is a corresponding PID config admin, setting up an external ui module?
        immediate = true
)
public class ExternalUiModule implements UiModule {

    static final String PID = "org.apache.brooklyn.ui.external.module";

    private static final Logger LOG = LoggerFactory.getLogger(PID);
    private static final Dictionary<String, ?> EMPTY_DICTIONARY = new Hashtable<>();

    private final String MODULE_TYPE = "external-ui-module";
    private final String KEY_ID = "service.pid";
    private final String KEY_NAME = "name";
    private final String KEY_URL = "url";
    private final String KEY_ICON = "icon";
    private final String KEY_TYPES = "types";
    private final String[] REQUIRED_KEYS = new String[] {KEY_ID, KEY_NAME, KEY_URL, KEY_ICON};
    private final String KEY_SUPERSEDES = "supersedes";
    private final String KEY_STOP_EXISTING = "stopExisting";

    private String id;
    private String name;
    private String icon;
    private String url;
    private Set<String> types;
    private Set<String> supersedes;
    private boolean stopExisting;

    @Activate
    public void activate(final Map<String, String> properties) {
        LOG.debug("Activating module "+this+": "+properties);
        if (!properties.containsKey(KEY_URL) && properties.containsKey("component.id")) {
            // activation properties aren't usually for a module; do this check to suppress warning
            LOG.debug("Not setting module properties for activation properties "+properties);
        } else {
            this.setModuleProperties(properties);
        }
    }

    @Modified
    public void modified(final Map<String, String> properties) {
        LOG.debug("Modified module "+this+": "+properties);
        this.setModuleProperties(properties);
    }

    private void setModuleProperties(Map<String, String> properties) {
        List<String> issues = MutableList.of();

        // Check if the required keys are available
        for (String requiredKey : REQUIRED_KEYS) {
            if (!properties.containsKey(requiredKey)) {
                issues.add("Key [" + requiredKey + "] is required");
            }
        }

        if (issues.size() > 0) {
            LOG.error("Invalid UI module (ignoring) [" + properties.get(KEY_ID) + "] ... " + issues.toString()+"; properties: "+properties, new Throwable("source of error"));
            return;
        }

        this.id = properties.get(KEY_ID);
        this.name = properties.get(KEY_NAME);
        this.icon = properties.get(KEY_ICON);
        this.url = properties.get(KEY_URL);
        
        this.types = MutableSet.of(MODULE_TYPE);
        final String userTypes = properties.get(KEY_TYPES);
        if (userTypes != null) {
            this.types.addAll(Arrays.asList(userTypes.split(",")));
        }
        
        this.supersedes = MutableSet.of(MODULE_TYPE);
        final String userSupersedes = properties.get(KEY_SUPERSEDES);
        if (userSupersedes != null) {
            this.supersedes.addAll(Arrays.asList(userSupersedes.split(",")));
        }

        this.stopExisting = properties.get(KEY_STOP_EXISTING)!=null ? Boolean.parseBoolean(properties.get(KEY_STOP_EXISTING)) : true;
    }

    @Override
    public String getId() {
        return this.id;
    }

    @Override
    public String getName() {
        return this.name;
    }

    @Override
    public String getSlug() {
        return this.id;
    }

    @Override
    public String getIcon() {
        return this.icon;
    }

    @Override
    public Set<String> getTypes() {
        return this.types;
    }

    @Override
    public Set<String> getSupersedesBundles() {
        return supersedes;
    }
    
    @Override
    public boolean getStopExisting() {
        return stopExisting;
    }
    
    @Override
    public String getPath() {
        return this.url;
    }

    @Override
    public List<UiModuleAction> getActions() {
        return ImmutableList.of();
    }
}
