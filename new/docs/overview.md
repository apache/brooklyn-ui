# Overview

## Architecture

The Brooklyn UI leverages OSGi to build a modular user interface: each UI module is an OSGi bundle (which effectively is a 
simple webapp running at a particular path context. Each UI module implements the Java interface `UiModule` which
is then used to register the module onto the UI modules registry (that runs on the OSGi container) upon bundle installation.

The registration process is as follow:
1. a bundle is installed into the OSGi container (Karaf for instance)
2. the UI modules registry scan the bundle for the `UiModule` interface:
   1. if found, the module is added to the registry
   2. otherwise, it is ignored by the registry

Similarly, the UI module is unregistered when the bundle is uninstall.

Beside the UI modules registry, there is also a special API (available at v1/ui-module-registry) which returns all
currently registered UI modules. This endpoint is then used by the home page (as well as the navigation drawer) to display
the right links.

## Folder Structure

Key points:
* `modularity-structure` contains server-side things
* `ui-modules` are UI modules bundled with Brooklyn (including home) and utils they use/share
* `features` is the osgi dist

## Karaf installation

### Full distribution

If you have a Karaf distribution, you can install the Brooklyn UI simply by running the following:

```
# use the correct BROOKLYN_VERSION_BELOW
feature:repo-add mvn:org.apache.brooklyn.ui/brooklyn-ui-features/1.0.0-SNAPSHOT/xml/features

feature:install brooklyn-ui
```

You should now have see the bundles if you run `bundle:list` and web modules with `web:list`,
and the app home page should now be available at [http://localhost:8081](http://localhost:8081).



### Specific UI module

Similarly to the full distribution, you can install each UI module separately as they provide their own feature:


```
feature:repo-add mvn:org.apache.brooklyn.ui/brooklyn-ui-feature/<brooklyn-version>/xml/features

feature:install brooklyn-ui-<module-name>
```

For example, to install the `brooklyn-ui-app-inspector`:

```
feature:install brooklyn-ui-app-inspector
```

## Features

### External UI module

One can register external UI modules thanks to the OSGi container. See `modularity-server/external-modules` for more information. 


### E2E Tests (WIP)

**NOTE** you must have protractor installed (see http://www.protractortest.org/)

Any module that has a `protractor.conf.js` file at its root has e3e tests.

Steps to Run:
1. Start webdriver `webdriver-manager start`
2. Start your the development server `npm start`
3. Run the tests `protractor`


# Troubleshooting

### Module not found

This can happen if you have built `brooklyn-ui-core` manually with an old version of node (< 4). In this case, delete the `node_modules` in all UI modules, upgrade `node` to the latest version and try again.

### npm build errors: NormalModule.onModuleBuildFailed

If there are npm build errors (e.g. in brooklyn-ui-home), try editing `ui-modules/home/package.json` to remove the `--bail` from the `"build": "rimraf ...` line, and re-run `npm run build` (in the `ui-modules/home` directory). This can give better errors about what is going wrong.

### "Library not loaded" error

The error below means that libpng is not installed:
```
Module build failed: Error: dyld: Library not loaded: /usr/local/opt/libpng/lib/libpng16.16.dylib
```

On os-x, try installing it (with the command below), and try again:
```
brew install libpng
```

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
