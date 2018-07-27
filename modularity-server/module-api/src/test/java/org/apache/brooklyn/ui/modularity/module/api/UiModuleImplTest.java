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

import java.util.Map;

import org.assertj.core.api.Assertions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testng.annotations.Test;
import org.yaml.snakeyaml.Yaml;

import org.apache.brooklyn.ui.modularity.module.api.internal.UiModuleImpl;

public class UiModuleImplTest {
    private static final Logger LOG = LoggerFactory.getLogger(UiModuleImplTest.class);

    @Test
    public void testUiModuleYamlLoad() {
        final String test = "" +
                "name: test-module\n" +
                "types: single-page-app\n" +
                "slug: my-test-app\n" +
                "actions:\n" +
                "- name: Test Action1\n" +
                "  icon: test-icon1\n" +
                "  path: '#/one/two/three'\n" +
                "- name: Test Action2\n" +
                "  icon: test-icon2\n" +
                "  path: '#/three/two/one'\n";
        final Map<String, ?> map = (Map<String, ?>) new Yaml().load(test);

        final UiModuleImpl result = UiModuleImpl.createFromMap(map);
        Assertions.assertThat(result.getId()).isNotEmpty();
        Assertions.assertThat(result.getName()).isEqualTo("test-module");
        Assertions.assertThat(result.getSlug()).isEqualTo("my-test-app");
        Assertions.assertThat(result.getIcon()).isEqualTo(UiModule.DEFAULT_ICON);

        Assertions.assertThat(result.getTypes()).hasSize(0);

        Assertions.assertThat(result.getActions()).hasSize(2);
        Assertions.assertThat(result.getActions().get(0).getName()).isEqualTo("Test Action1");
        Assertions.assertThat(result.getActions().get(0).getPath()).isEqualTo("#/one/two/three");
        Assertions.assertThat(result.getActions().get(0).getIcon()).isEqualTo("test-icon1");
        Assertions.assertThat(result.getActions().get(1).getName()).isEqualTo("Test Action2");
        Assertions.assertThat(result.getActions().get(1).getPath()).isEqualTo("#/three/two/one");
        Assertions.assertThat(result.getActions().get(1).getIcon()).isEqualTo("test-icon2");
    }

    @Test
    public void testUiModuleYamlLoadWithTypesArray() {
        final String test = "" +
                "name: test-module\n" +
                "types:\n" +
                "- single-page-app\n" +
                "- home-ui-module\n" +
                "slug: my-test-app\n";
        final Map<String, ?> map = (Map<String, ?>) new Yaml().load(test);

        final UiModuleImpl result = UiModuleImpl.createFromMap(map);
        Assertions.assertThat(result.getId()).isNotEmpty();
        Assertions.assertThat(result.getName()).isEqualTo("test-module");
        Assertions.assertThat(result.getSlug()).isEqualTo("my-test-app");
        Assertions.assertThat(result.getIcon()).isEqualTo(UiModule.DEFAULT_ICON);

        Assertions.assertThat(result.getTypes()).hasSize(2);
        Assertions.assertThat(result.getTypes().contains("single-page-app")).isTrue();
        Assertions.assertThat(result.getTypes().contains("home-ui-module")).isTrue();
    }

    @Test
    public void testUiModuleYamlLoadWithTypesArrayAvoidDuplicates() {
        final String test = "" +
                "name: test-module\n" +
                "types:\n" +
                "- single-page-app\n" +
                "- single-page-app\n" +
                "slug: my-test-app\n";
        final Map<String, ?> map = (Map<String, ?>) new Yaml().load(test);

        final UiModuleImpl result = UiModuleImpl.createFromMap(map);
        Assertions.assertThat(result.getId()).isNotEmpty();
        Assertions.assertThat(result.getName()).isEqualTo("test-module");
        Assertions.assertThat(result.getSlug()).isEqualTo("my-test-app");
        Assertions.assertThat(result.getIcon()).isEqualTo(UiModule.DEFAULT_ICON);

        Assertions.assertThat(result.getTypes()).hasSize(1);
        Assertions.assertThat(result.getTypes().contains("single-page-app")).isTrue();
    }
}
