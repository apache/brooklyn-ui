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

import java.io.InputStream;
import java.time.Duration;
import java.util.Dictionary;
import java.util.Hashtable;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import javax.servlet.ServletContext;
import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;

import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.FrameworkUtil;
import org.osgi.framework.ServiceRegistration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.yaml.snakeyaml.Yaml;

import org.apache.brooklyn.ui.modularity.module.api.internal.UiModuleImpl;

/** Invoked by modules in their web.xml to create and register the {@link UiModule} service for that UI module. */
public class UiModuleListener implements ServletContextListener {
    
    private static final Logger LOG = LoggerFactory.getLogger(UiModuleListener.class);
    private static final Dictionary<String, ?> EMPTY_DICTIONARY = new Hashtable<>();
    public static final String CONFIG_PATH = "/WEB-INF/classes/ui-module/config.yaml";

    private ServiceRegistration<UiModule> registration;

    public UiModuleListener() {
    }

    public void contextInitialized(ServletContextEvent servletContextEvent) {
        final UiModule uiModule = createUiModule(servletContextEvent.getServletContext());
        Object moduleBundle = servletContextEvent.getServletContext().getAttribute("osgi-bundlecontext");
        
        // register service against the bundle where it came from if possible (it always is, from what I've seen)
        // this prevents errors if this.getClass()'s bundle is not yet active and avoids needing to delay
        // (it also means service would be unregistered on that bundle destroy without listening for servlet context
        // destroy but servlet context destroy is useful for symmetry with this and in case it is destroyed without 
        // destroying the bundle; also we were already doing it)
        final Bundle bundle = moduleBundle instanceof BundleContext ? ((BundleContext)moduleBundle).getBundle() : FrameworkUtil.getBundle(this.getClass());
        
        try {
            if (bundle.getState() != Bundle.ACTIVE) {
                final Duration TIMEOUT = Duration.ofMinutes(2);
                LOG.warn("Bundle [{}] not ACTIVE to register Brooklyn UI module [{}], bundle current state [{}], will wait up to {}", 
                    bundle.getSymbolicName(), uiModule.getName(), bundle.getState(), TIMEOUT);
                blockUntilBundleStarted(bundle, TIMEOUT);
            }
            LOG.info("Registering new Brooklyn UI module [{}] to [{}] (bundle [{}:{}])", uiModule.getName(), uiModule.getPath(), bundle.getSymbolicName(), bundle.getVersion());
            registration = bundle.getBundleContext().registerService(UiModule.class, uiModule, EMPTY_DICTIONARY);
        } catch (Exception e) {
            LOG.error("Failed registration of Brooklyn UI module [" + uiModule.getName() + "] to [" + uiModule.getPath() + "]: "+e, e);
        }
    }
    
    private void blockUntilBundleStarted(final Bundle bundle, Duration timeout) throws InterruptedException {
        long endTime = System.currentTimeMillis() + timeout.toMillis();
        do {
            TimeUnit.MILLISECONDS.sleep(100);
            LOG.trace("Waiting for bundle [{}] to be ACTIVE, current state [{}]", bundle.getSymbolicName(), bundle.getState());
            if (bundle.getState() == Bundle.ACTIVE) {
                return;
            }
        } while (System.currentTimeMillis() < endTime);
        throw new IllegalStateException("Bundle "+bundle.getSymbolicName()+":"+bundle.getVersion()+" is not ACTIVE, even after waiting");
    }
        
    @Override
    public void contextDestroyed(ServletContextEvent servletContextEvent) {
        LOG.info("Un-Registering Brooklyn UI module at [{}]", servletContextEvent.getServletContext().getContextPath());
        if (registration != null) {
            try {
                registration.unregister();
            } catch (IllegalStateException e) {
                if (e.toString().contains("already unregistered")) {
                    LOG.debug("In {}, service already unregistered, on contextDestroyed for context {}", this, servletContextEvent);
                } else {
                    LOG.warn("Problem unregistering service in " + this + ", on contextDestroyed for context " + servletContextEvent + " (continuing)", e);
                }
            }
            registration = null;
        }
    }

    private UiModule createUiModule(ServletContext servletContext) {
        final InputStream is = servletContext.getResourceAsStream(CONFIG_PATH);
        final String path = servletContext.getContextPath();
        if (is == null) {
            throw new RuntimeException(String.format("Module on path [%s] will not be registered as it does not have any configuration", path));
        }
        @SuppressWarnings("unchecked")
        Map<String, ?> config = (Map<String, ?>) new Yaml().load(is);
        return UiModuleImpl.createFromMap(config).path(path);
    }
}
