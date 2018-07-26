# External UI Modules

UI modules leverage OSGi to register themselves to the [`module-registry`](./../module-registry).
One can use the same mechanism to register external UI modules.

## Register External UI Module

By default, external UI modules are not displayed in the home page to keep it de-cluttered. 
You can override this behaviour by adding a type `home-ui-module` as configuration (see how-to based on the method you are using)

### Via an enricher

An entity can publish an external UI module though the `org.apache.brooklyn.ui.modularity.enricher.BrooklynExternalUiModuleEnricher` like so:

  ```yaml
  brooklyn.enricher:
  - type: org.apache.brooklyn.ui.modularity.enricher.BrooklynExternalUiModuleEnricher
    brooklyn.config:
      # The fontawesome icon class to use
      external.ui.module.icon: fa-cog
      external.ui.module.name: My External UI Module
      # ID, hyphen-separated string
      external.ui.module.slug: my-external-module 
      # Sensor on this entity where the URL for this UI module should be published, default as `main.uri`
      external.ui.module.url.sensor: $brooklyn.sensor('...') 
  ```

Here is a table of the available configuration keys

| Configuration key | Type | Required | Default |
| --- | --- | --- | --- |
| `external.ui.module.icon` | String | No | `fa-external-link` |
| `external.ui.module.name` | String | No | |
| `external.ui.module.slug` | String | Yes | |
| `external.ui.module.url.sensor` | Sensor | Yes | use the `main.uri` sensor|
| `external.ui.module.type` | List | No | Custom type to apply. *Note that if you wish to display the external UI module to the home page, you need to add `home-ui-module` as a type* |

### Via configuration files

Simple create a file named `org.apache.brooklyn.ui.external.module-<slug>.cfg` with the following content:

```
name=My external module
icon=fa-tasks
url=http://my.site/
types=my-module-type,other-module-type
```

Each file will generate a new external UI module.

*Note that if you wish to display the external UI module to the home page, you need to add `home-ui-module` as a type*

<!--
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
-->
