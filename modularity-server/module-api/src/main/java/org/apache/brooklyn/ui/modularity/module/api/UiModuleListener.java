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
import java.net.URL;
import java.time.Duration;
import java.util.Collection;
import java.util.Dictionary;
import java.util.Hashtable;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import javax.servlet.ServletContext;
import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;

import org.apache.brooklyn.ui.modularity.module.api.internal.UiModuleImpl;
import org.apache.karaf.web.WebBundle;
import org.apache.karaf.web.WebContainerService;
import org.ops4j.pax.web.service.spi.WebEvent;
import org.ops4j.pax.web.service.spi.WebListener;
import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.FrameworkUtil;
import org.osgi.framework.ServiceReference;
import org.osgi.framework.ServiceRegistration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.yaml.snakeyaml.Yaml;

/** Invoked by modules in their web.xml to create and register the {@link UiModule} service for that UI module. */
public class UiModuleListener implements ServletContextListener {
    
    private static final Logger LOG = LoggerFactory.getLogger(UiModuleListener.class);
    private static final Dictionary<String, ?> EMPTY_DICTIONARY = new Hashtable<>();
    public static final String CONFIG_PATH = "/WEB-INF/classes/ui-module/config.yaml";

    private ServiceRegistration<UiModule> registration;
    private AtomicReference<WebListener> listener = new AtomicReference<>();

    public UiModuleListener() {
    }

    public void contextInitialized(ServletContextEvent servletContextEvent) {
        final UiModule uiModule = createUiModule(servletContextEvent.getServletContext());
        Object moduleBundle = servletContextEvent.getServletContext().getAttribute("osgi-bundlecontext");
        final Bundle bundle = moduleBundle instanceof BundleContext ? ((BundleContext)moduleBundle).getBundle() : FrameworkUtil.getBundle(this.getClass());
        
        initWebListener(bundle);
        
        // register service against the bundle where it came from if possible (it always is, from what I've seen)
        // this prevents errors if this.getClass()'s bundle is not yet active and avoids needing to delay
        // (it also means service would be unregistered on that bundle destroy without listening for servlet context
        // destroy but servlet context destroy is useful for symmetry with this and in case it is destroyed without 
        // destroying the bundle; also we were already doing it)
        
        try {
            if (bundle.getState() != Bundle.ACTIVE) {
                final Duration TIMEOUT = Duration.ofMinutes(2);
                LOG.warn("Bundle [{}] not ACTIVE to register Brooklyn UI module [{}], bundle current state [{}], will wait up to {}", 
                    bundle.getSymbolicName(), uiModule.getName(), bundle.getState(), TIMEOUT);
                blockUntilBundleStarted(bundle, TIMEOUT);
            }
            LOG.info("Registering new Brooklyn UI module {}:{} [{}] called '{}' on context-path '{}'", 
                bundle.getSymbolicName(), bundle.getVersion(), bundle.getVersion(), uiModule.getName(), uiModule.getPath() );
            registration = bundle.getBundleContext().registerService(UiModule.class, uiModule, EMPTY_DICTIONARY);
            LOG.trace("ServletContextListener on initializing UI module "+bundle.getSymbolicName()+" ["+bundle.getBundleId()+"] "
                + "to "+uiModule.getPath()+", checking whether any bundles need stopping");
            stopAnyExistingOrSuperseded(uiModule, bundle);
        } catch (Exception e) {
            LOG.error("Failed registration of Brooklyn UI module [" + uiModule.getName() + "] to [" + uiModule.getPath() + "]: "+e, e);
        }
    }

    private void initWebListener(Bundle bundle) {
        if (listener.compareAndSet(null, new UiModuleWebListener())) {
            bundle.getBundleContext().registerService(WebListener.class, listener.get(), null);
        }
    }

    public class UiModuleWebListener implements WebListener {
        long lastId = -1;
        @Override
        public void webEvent(WebEvent event) {
            try {
                if (event.getType() == WebEvent.DEPLOYING && lastId != event.getBundleId()) {
                    // on deployment of new bundles check whether they are UI modules
                    // (this seems to be called about 10 times for any deployment; keep a note of the last bundle id to avoid duplication
                    lastId = event.getBundleId();
                    URL config = event.getBundle().getResource(CONFIG_PATH);
                    if (config!=null) {
                        LOG.trace("WebListener on deploying UI module "+event.getBundle().getSymbolicName()+" ["+event.getBundleId()+"] "
                            + "to "+event.getContextPath()+", checking whether any bundles need stopping");
                        stopAnyExistingOrSuperseded(createUiModule(config.openStream(), event.getContextPath()), event.getBundle());
                    }
                }
            } catch (Exception e) {
                if (!isBundleStartingOrActive(event.getBundle())) {
                    LOG.debug("Error listening to UI module bundle "+event.getBundleName()+" in state "+event.getBundle().getState()+" (not starting/active, so not a serious problem, esp if we just stopped it): "+e);
                } else {
                    LOG.warn("Error listening to UI module bundle "+event.getBundleName()+" start: "+e, e);
                }
            }
        }
    }
    
    protected void stopAnyExistingOrSuperseded(final UiModule uiModule, final Bundle bundle) throws Exception {
        if (uiModule.getStopExisting()) {
            stopExistingModulesListeningOnOurEndpoint(bundle, uiModule);
        }
        if (!uiModule.getSupersedesBundles().isEmpty()) {
            stopSupersededBundles(bundle, uiModule);
        }
    }
    
    /** stop modules on the same endpoint that with a lower number ID;
     * or if a module supersedes us, stop ourselves */
    private void stopExistingModulesListeningOnOurEndpoint(Bundle bundle, UiModule uiModule) throws Exception {
        ServiceReference<WebContainerService> webS = bundle.getBundleContext().getServiceReference(WebContainerService.class);
        WebContainerService web = bundle.getBundleContext().getService(webS);
        
        for (WebBundle bi: web.list()) {
            if (bi.getBundleId()==bundle.getBundleId()) continue;
            if (uiModule.getPath().equals(bi.getContextPath()) || (uiModule.getPath().equals("") && bi.getContextPath().equals("/"))) {
                Bundle bb = bundle.getBundleContext().getBundle(bi.getBundleId());
                Collection<ServiceReference<UiModule>> modules = bundle.getBundleContext().getServiceReferences(UiModule.class, null);
                for (ServiceReference<UiModule> modS: modules) {
                    if (modS.getBundle()!=null && modS.getBundle().getBundleId()==bi.getBundleId()) {
                        // found UiModule for the potentially conflicting bundle
                        UiModule mod = bundle.getBundleContext().getService(modS);
                        if (isBundleSuperseded(mod, bundle)) {
                            // if that module supersedes us, don't stop them, stop us!
                            stopBundle(bundle, "context path "+bi.getContextPath()+" is in use by "+bb.getSymbolicName()+" ["+bb.getBundleId()+"]");
                            return;
                        }
                    }
                }
                if (bb.getBundleId() < bundle.getBundleId()) {
                    // in case of context-path conflict with no declared supersedes relationship, prefer the higher number (later installed)
                    stopBundle(bb, "context path "+bi.getContextPath()+" is needed for installation of "+bundle.getSymbolicName()+" ["+bundle.getBundleId()+"]");
                }
            }
        }
    }

    /** stop modules superseded by us */
    private void stopSupersededBundles(Bundle bundle, UiModule uiModule) {
        LOG.trace("Calling stopSuperseded on install of "+bundle.getSymbolicName()+"; will stop any of "+uiModule.getSupersedesBundles());
        for (Bundle b: bundle.getBundleContext().getBundles()) {
            if (b.getBundleId()==bundle.getBundleId()) continue;
            if (isBundleSuperseded(uiModule, b)) {
                stopBundle(b, "it is superseded by "+bundle.getSymbolicName()+" ["+bundle.getBundleId()+"]");
            }
        }
    }

    private boolean isBundleSuperseded(UiModule module, Bundle bundle) {
        if (module.getSupersedesBundles()!=null) {
            for (String superseded: module.getSupersedesBundles()) {
                String bn = superseded;
                String version = null;
                int split = bn.indexOf(':');
                if (split>=0) {
                    version = bn.substring(split+1);
                    bn = bn.substring(0, split);
                }
                if (bundle.getSymbolicName().matches(bn) && (version==null || bundle.getVersion().toString().matches(version))) {
                    return true;
                }
            }
        }
        return false;
    }

    protected void stopBundle(Bundle bundleToStop, String reason) {
        boolean isActive = isBundleStartingOrActive(bundleToStop);
        String message = "stopping bundle "+bundleToStop.getSymbolicName()+" ["+bundleToStop.getBundleId()+"]; "+reason;
        if (!isActive) {
            LOG.trace("Not "+message+"; but that conflicting bundle is not starting or active");
            // if it tries to start it should abort itself
            return;
        }
        LOG.info("UiModules: " + message);
        new Thread(() -> { 
            try {
                bundleToStop.stop(); 
            } catch (Exception e) {
                LOG.warn("UiModules: error "+message+": "+e, e);
            }
        }).start();
    }

    protected boolean isBundleStartingOrActive(Bundle bundleToStop) {
        switch (bundleToStop.getState()) {
        case Bundle.START_TRANSIENT:
        case Bundle.STARTING:
        case Bundle.ACTIVE:
            return true;
        }
        return false;
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
        LOG.info("Unregistering Brooklyn UI module at [{}]", servletContextEvent.getServletContext().getContextPath());
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
        return createUiModule(is, path);
    }

    protected UiModule createUiModule(final InputStream is, final String path) {
        if (is == null) {
            throw new RuntimeException(String.format("Module on path [%s] will not be registered as it does not have any configuration", path));
        }
        @SuppressWarnings("unchecked")
        Map<String, ?> config = (Map<String, ?>) new Yaml().load(is);
        return UiModuleImpl.createFromMap(config).path(path);
    }
}
