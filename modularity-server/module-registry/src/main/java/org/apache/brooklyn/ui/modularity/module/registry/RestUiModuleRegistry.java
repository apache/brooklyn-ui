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

import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import org.apache.brooklyn.ui.modularity.module.api.UiModule;
import org.apache.brooklyn.ui.modularity.module.api.UiModuleRegistry;

import com.google.common.base.Function;
import com.google.common.collect.Iterables;
import com.google.common.collect.Ordering;

@Path("/")
public class RestUiModuleRegistry {

    private UiModuleRegistry uiModuleRegistry;
    private static final Function<UiModule, String> GET_NAME_FUNCTION = new Function<UiModule, String>() {
        @Override
        public String apply(UiModule input) {
            if (input != null) {
                return input.getName();
            }
            return "";
        }
    };

    @GET
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.APPLICATION_JSON)
    public Collection<UiModule> getRegisteredWebComponents() {
        return Ordering.natural()
                .onResultOf(GET_NAME_FUNCTION)
                .immutableSortedCopy(
                    // turn it from a proxy to a serializable bean
                    Iterables.transform(uiModuleRegistry.getRegisteredModules(), x -> UiModule.Utils.copyUiModule(x)));
    }

    public void setUiModuleRegistry(final UiModuleRegistry uiModuleRegistry) {
        this.uiModuleRegistry = uiModuleRegistry;
    }
}
