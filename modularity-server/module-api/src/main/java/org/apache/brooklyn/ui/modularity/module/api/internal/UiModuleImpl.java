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
package org.apache.brooklyn.ui.modularity.module.api.internal;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.apache.brooklyn.ui.modularity.module.api.UiModule;
import org.apache.brooklyn.ui.modularity.module.api.UiModuleAction;

import com.google.common.base.Optional;

public class UiModuleImpl implements UiModule {
    private String id;
    private String name;
    private String slug;
    private String icon;
    private Set<String> types = new LinkedHashSet<>();
    private Set<String> supersedesBundles = new LinkedHashSet<>();
    private boolean stopExisting = true;
    private String path;
    private List<UiModuleAction> actions = new ArrayList<>();

    public static UiModuleImpl copyOf(UiModule src) {
        final UiModuleImpl result = new UiModuleImpl();
        result.setId(src.getId());
        result.setName(src.getName());
        result.setSlug(src.getSlug());
        result.setIcon(src.getIcon());
        if (src.getTypes()!=null) result.types.addAll(src.getTypes());
        if (src.getSupersedesBundles()!=null) result.supersedesBundles.addAll(src.getSupersedesBundles());
        result.setStopExisting(src.getStopExisting());
        result.setPath(src.getPath());
        if (src.getActions()!=null) result.actions.addAll(src.getActions());
        return result;
    }
    
    public static UiModuleImpl createFromMap(final Map<String, ?> incomingMap) {
        final UiModuleImpl result = new UiModuleImpl();
        result.setId(Optional.fromNullable((String) incomingMap.get("id")).or(UUID.randomUUID().toString()));
        result.setName(Optional.fromNullable((String) incomingMap.get("name")).or(result.getId()));
        result.setSlug((String) incomingMap.get("slug"));
        result.setIcon(Optional.fromNullable((String) incomingMap.get("icon")).or(DEFAULT_ICON));
        final Object types = incomingMap.get("types");
        if (types != null && types instanceof List) {
            @SuppressWarnings("unchecked")
            List<String> typesTyped = (List<String>) types;
            result.setTypes(new LinkedHashSet<String>(typesTyped));
        }
        final Object supersedes = incomingMap.get("supersedes");
        if (supersedes != null && supersedes instanceof List) {
            @SuppressWarnings("unchecked")
            List<String> supersedesTyped = (List<String>) supersedes;
            result.setSupersedesBundles(new LinkedHashSet<String>(supersedesTyped));
        }
        if (incomingMap.containsKey("stopExisting")) {
            result.setStopExisting(Boolean.getBoolean((String) incomingMap.get("stopExisting")));
        }
        final Object actions = incomingMap.get("actions");
        if (actions != null && actions instanceof List) {
            for (Object action : (List<?>) actions) {
                @SuppressWarnings("unchecked")
                Map<String, ?> actionTyped = (Map<String, ?>) action;
                result.action(UiModuleActionImpl.createFromMap(actionTyped));
            }
        }
        return result;
    }

    @Override
    public String getId() {
        return id;
    }

    @Override
    public String getIcon() {
        return icon;
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
    public Set<String> getTypes() {
        return types;
    }

    @Override
    public Set<String> getSupersedesBundles() {
        return supersedesBundles;
    }
    
    @Override
    public boolean getStopExisting() {
        return stopExisting;
    }

    @Override
    public String getPath() {
        return path;
    }

    @Override
    public List<UiModuleAction> getActions() {
        return actions;
    }

    public void setId(final String id) {
        this.id = id;
    }

    public void setIcon(final String icon) {
        this.icon = icon;
    }

    public void setName(final String name) {
        this.name = name;
    }

    public void setSlug(final String slug) {
        this.slug = slug;
    }

    public void setTypes(final Set<String> types) {
        this.types = types;
    }

    public void setSupersedesBundles(final Set<String> supersedesBundles) {
        this.supersedesBundles = supersedesBundles;
    }
    
    public void setStopExisting(final boolean stopExisting) {
        this.stopExisting = stopExisting;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public void setActions(final List<UiModuleAction> actions) {
        this.actions = actions;
    }

    public UiModuleImpl id(final String id) {
        this.id = id;
        return this;
    }

    public UiModuleImpl icon(final String icon) {
        this.icon = icon;
        return this;
    }

    public UiModuleImpl name(final String name) {
        this.name = name;
        return this;
    }

    public UiModuleImpl slug(final String slug) {
        this.slug = slug;
        return this;
    }

    public UiModuleImpl types(final Set<String> types) {
        this.types = types;
        return this;
    }

    public UiModuleImpl path(final String path) {
        this.path = path;
        return this;
    }

    public UiModuleImpl action(final UiModuleAction action) {
        actions.add(action);
        return this;
    }
}
