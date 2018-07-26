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
package org.apache.brooklyn.ui.modularity.enricher;

import java.util.Dictionary;
import java.util.Hashtable;
import java.util.List;
import java.util.Set;

import org.apache.brooklyn.api.entity.EntityLocal;
import org.apache.brooklyn.api.sensor.AttributeSensor;
import org.apache.brooklyn.api.sensor.Sensor;
import org.apache.brooklyn.api.sensor.SensorEvent;
import org.apache.brooklyn.api.sensor.SensorEventListener;
import org.apache.brooklyn.config.ConfigKey;
import org.apache.brooklyn.core.config.ConfigKeys;
import org.apache.brooklyn.core.enricher.AbstractEnricher;
import org.apache.brooklyn.core.entity.Attributes;
import org.apache.brooklyn.util.collections.MutableSet;
import org.apache.brooklyn.util.core.flags.TypeCoercions;
import org.osgi.framework.Bundle;
import org.osgi.framework.FrameworkUtil;
import org.osgi.framework.ServiceRegistration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.common.collect.ImmutableList;
import com.google.common.reflect.TypeToken;

import org.apache.brooklyn.ui.modularity.module.api.UiModule;
import org.apache.brooklyn.ui.modularity.module.api.UiModuleAction;

public class BrooklynExternalUiModuleEnricher extends AbstractEnricher {
    private static final Logger LOG = LoggerFactory.getLogger(BrooklynExternalUiModuleEnricher.class);
    private static final Dictionary<String, ?> EMPTY_DICTIONARY = new Hashtable<>();

    public static final ConfigKey<String> MODULE_ICON = ConfigKeys.newStringConfigKey(
            "external.ui.module.icon", "Module icon", "fa-external-link");
    public static final ConfigKey<String> MODULE_NAME = ConfigKeys.newStringConfigKey(
            "external.ui.module.name", "Module name");
    public static final ConfigKey<String> MODULE_SLUG = ConfigKeys.newStringConfigKey(
            "external.ui.module.slug", "Module slug");
    public static final ConfigKey<List<String>> MODULE_TYPE = ConfigKeys.newConfigKey(new TypeToken<List<String>>() {}, "external.ui.module.types", "Module types", ImmutableList.<String>of());
    public static final ConfigKey<Sensor<?>> MODULE_URL_SENSOR_TO_MONITOR =
            (ConfigKey) ConfigKeys.newConfigKey(Sensor.class, "external.ui.module.url.sensor", "Module URL Sensor", Attributes.MAIN_URI);

    private ServiceRegistration<UiModule> registration;

    @Override
    public void setEntity(final EntityLocal entity) {
        super.setEntity(entity);
        if (getConfig(MODULE_NAME) == null) {
            config().set(MODULE_NAME, entity.getDisplayName() + " UI");
        }
        entity.subscriptions().subscribe(entity, Attributes.SERVICE_UP, new SensorEventListener<Boolean>() {
            @Override
            public void onEvent(final SensorEvent<Boolean> event) {
                if (event.getValue() != null && event.getValue()) {
                    register((String) entity.sensors().get((AttributeSensor<Object>) getConfig(MODULE_URL_SENSOR_TO_MONITOR)));
                } else {
                    unregister();
                }
            }
        });
        entity.subscriptions().subscribe(entity, getConfig(MODULE_URL_SENSOR_TO_MONITOR), new SensorEventListener<Object>() {
            @Override
            public void onEvent(SensorEvent<Object> event) {
                if (event.getValue() != null) {
                    register(TypeCoercions.coerce(event.getValue(), String.class));
                }
            }
        });
    }


    synchronized private void register(final String url) {
        try {
            unregister();
            final Bundle bundle = FrameworkUtil.getBundle(this.getClass());
            if (bundle == null) {
                LOG.debug("Could not register external UI module [{} :: {}] ... Could not load bundle context", getId(), getConfig(MODULE_NAME));
            } else {
                final Set<String> types = MutableSet.<String>builder().add("external-ui-module").addAll(getConfig(MODULE_TYPE)).build();
                final UiModule uiModule = newUiModule(getId(), getConfig(MODULE_NAME), getConfig(MODULE_SLUG), types, url, getConfig(MODULE_ICON));
                registration = bundle.getBundleContext().registerService(
                        UiModule.class, uiModule, EMPTY_DICTIONARY);
                LOG.debug("Registered external UI module [{} :: {}]", getId(), getConfig(MODULE_NAME));
            }
        } catch (Exception e) {
            LOG.info("Could not register external UI module [{} :: {}] ... {}", new Object[]{getId(), getConfig(MODULE_NAME), e.getMessage()});
        }
    }

    synchronized private void unregister() {
        if (registration != null) {
            try {
                registration.unregister();
                LOG.debug("Unregistered external UI module [{} :: {}]", getId(), getConfig(MODULE_NAME));
            } catch (IllegalStateException e) {
                LOG.debug("Could not unregister external UI module [{} :: {}]  ... {}", new Object[]{getId(), getConfig(MODULE_NAME), e.getMessage()});
            }
            registration = null;
        }
    }

    private UiModule newUiModule(final String id, final String name, final String slug, final Set<String> types, final String url, final String icon) {
        return new UiModule() {
            @Override
            public String getId() {
                return id;
            }

            @Override
            public String getName() {
                return name;
            }

            @Override
            public String getSlug() {
                return slug;
            }

            @Override
            public String getIcon() {
                return icon;
            }

            @Override
            public Set<String> getTypes() {
                return types;
            }

            @Override
            public String getPath() {
                return url;
            }

            @Override
            public List<UiModuleAction> getActions() {
                return ImmutableList.of();
            }
        };
    }
}
