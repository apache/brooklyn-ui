Builds the feature for all Brooklyn UI items and installs into mvn.

Install into OSGi via the Karaf shell; after building
and installing to a mvn repo, run the commands:

* `feature:repo-add mvn:org.apache.brooklyn.ui/brooklyn-ui-features/${project.version}/xml/features`
* `feature:install -r brooklyn-ui`

Note the need to `-r` to prevent bundle refresh, otherwise Karaf goes a little crazy
trying to refresh and stop an odd set of other bundles in most cases.

Note that `feature:uninstall` doesn't normally do much, we think because these are boot features.

If you are just rebuilding WARs see the README in `ui-modules`.

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
