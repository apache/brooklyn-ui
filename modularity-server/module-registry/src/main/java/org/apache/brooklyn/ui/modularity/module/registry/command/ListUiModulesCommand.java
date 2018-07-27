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
package org.apache.brooklyn.ui.modularity.module.registry.command;


import org.apache.brooklyn.ui.modularity.module.api.UiModule;
import org.apache.brooklyn.ui.modularity.module.api.UiModuleRegistry;
import org.apache.karaf.shell.api.action.Action;
import org.apache.karaf.shell.api.action.Command;
import org.apache.karaf.shell.api.action.lifecycle.Reference;
import org.apache.karaf.shell.api.action.lifecycle.Service;
import org.apache.karaf.shell.support.table.ShellTable;

@Command(scope = "brooklyn", name = "list-ui-modules", description = "List registered Brooklyn UI Modules")
@Service
public class ListUiModulesCommand implements Action {

    @Reference
    private UiModuleRegistry registry;

    public Object execute() throws Exception {
        ShellTable table = new ShellTable();
        table.column("ID");
        table.column("NAME");
        table.column("TYPES");
        table.column("PATH");

        for (final UiModule component : registry.getRegisteredModules()) {
            table.addRow().addContent(
                    component.getId(), component.getName(), component.getTypes(), component.getPath());
        }
        table.print(System.out, true);
        return null;
    }
}
