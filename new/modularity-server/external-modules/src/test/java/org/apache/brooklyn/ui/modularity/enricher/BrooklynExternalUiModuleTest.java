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

import org.apache.brooklyn.api.location.LocationSpec;
import org.apache.brooklyn.api.mgmt.ManagementContext;
import org.apache.brooklyn.api.sensor.EnricherSpec;
import org.apache.brooklyn.core.test.entity.TestApplication;
import org.apache.brooklyn.location.localhost.LocalhostMachineProvisioningLocation;
import org.testng.annotations.AfterTest;
import org.testng.annotations.BeforeTest;
import org.testng.annotations.Test;

import java.util.Arrays;
import java.util.UUID;

public class BrooklynExternalUiModuleTest {

    private String testId;
    private TestApplication app;
    private ManagementContext managementContext;
    private LocalhostMachineProvisioningLocation location;

    @BeforeTest
    public void setup() {
        testId = UUID.randomUUID().toString();
        app = TestApplication.Factory.newManagedInstanceForTests();
        managementContext = app.getManagementContext();
        location = managementContext.getLocationManager()
                .createLocation(LocationSpec.create(LocalhostMachineProvisioningLocation.class)
                        .configure("name", testId));
    }

    @AfterTest
    public void tearDown() {
        app.stop();
    }

    @Test
    public void testApp() {
        EnricherSpec enricherSpec = EnricherSpec.create(BrooklynExternalUiModuleEnricher.class)
                .configure(BrooklynExternalUiModuleEnricher.MODULE_ICON, "test-icon")
                .configure(BrooklynExternalUiModuleEnricher.MODULE_NAME, "test-name")
                .configure(BrooklynExternalUiModuleEnricher.MODULE_SLUG, "test-slug");
        app.enrichers().add(enricherSpec);
        app.start(Arrays.asList(location));
    }
}
