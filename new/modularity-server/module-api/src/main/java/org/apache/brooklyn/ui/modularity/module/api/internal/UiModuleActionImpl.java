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

import com.google.common.base.Optional;
import org.apache.brooklyn.ui.modularity.module.api.UiModuleAction;

import java.util.Map;

public class UiModuleActionImpl implements UiModuleAction {
    private String name;
    private String path;
    private String icon;

    public static UiModuleActionImpl createFromMap(Map<String, ?> incomingMap) {
        UiModuleActionImpl result = new UiModuleActionImpl();
        result.setName(Optional.fromNullable((String) incomingMap.get("name")).or(""));
        result.setPath(Optional.fromNullable((String) incomingMap.get("path")).or("#/"));
        result.setIcon(Optional.fromNullable((String) incomingMap.get("icon")).or(DEFAULT_ICON));
        return result;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public String getPath() {
        return path;
    }

    @Override
    public String getIcon() {
        return icon;
    }


    public void setName(final String name) {
        this.name = name;
    }

    public void setPath(final String path) {
        this.path = path;
    }

    public void setIcon(final String icon) {
        this.icon = icon;
    }

    public UiModuleAction name(final String name) {
        this.name = name;
        return this;
    }

    public UiModuleAction path(final String path) {
        this.path = path;
        return this;
    }

    public UiModuleAction icon(final String icon) {
        this.icon = icon;
        return this;
    }

}
