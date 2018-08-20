This folder contains projects which help working with and extending the UI:

* `module-api`: pattern for UI projects to advertise themselves as UI modules
* `module-registry`: track installed UI modules and serve them at `/ui-module-registry`
* `external-modules`: enricher to allow entities to install new modules 
* `metadata-registry`: supply miscellaneous server-supplied data at `/ui-metadata-registry`
* `proxy`: simple proxy server
* `feature`: builds this as an OSGi feature 

Note that UI modules themselves are in `../ui-modules`.

# UI Module Config

A Brooklyn UI module is a WAR being installed which includes a file `ui-module/config.yaml`
defining at minimum:

* a `name` (to be displayed in the UI)
* a `slug` (used internally for reference; usually this is set to be `${project.artifactId}` and substituted during the build)
* an `icon` CSS class set, usually Font Awesome based (e.g. `fa-home`).  

Optionally it can include:

* a list of `type` tokens for arbitrary use (currently `home-ui-module` is used to indicate a module should
  show up on the home page, and `library-ui-module` to indicate it should be excluded from the menu)
* `actions` (not used currently, see code to understand)
* `stopExisting` (boolean, whether to stop lower-numbered bundles listening on the same
  context-path declared in `web.xml`, defaulting to `true`)
* `supersedes` (a list of `bundle-regex:version-regex` of bundles that should be stopped 
  when this UI module is installed; this is used for downstream projects that may override UI modules 
  and wish to ensure their modules are used without relying on bundle install order (but often bundle install order is sufficient))

The Karaf command `web:list` is helpful in determining which module is actually active
when there are conflicts for a given context path.

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
