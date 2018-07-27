# Skinning the UI

The UI is designed to be skinnable with very little effort, and the resulting artifacts can be added to a Brooklyn server or distribution.

## Creating a Skin

You will need a folder somewhere that contains the theme data you wish to apply.  It is recommended that this folder be under source control.  It can be a part of a larger project.

Within this folder you will need two files:

    brand.properties   # properties exposed by the UI for customization purposes
    brand.less         # style vars your theme overrides and custom style rules your theme adds

In the Git repo, look at `/ui-modules/branding/monochrome/brand.{properties,less}` for a minimal example,
or `/ui-modules/branding/brand.{properties,less}` for a complete list.

If you wish to refer to your own resources such as images or HTML files, they can be in under this directory and referenced with the prefix `brand/`.
For example if you have `acme-logo.png` in this folder, you might want to set `product.logo.img=brand/acme-logo.png`.
(The UI code will then use your logo in various places.)

Other tips:

* UI shared content (from the folder `/ui-modules/shared/`) and be referenced with the prefix `brooklyn-shared/`
* You can supply your own partials (HTML fragments) in some properties, and in these you can refer to properties you've set
  under the `brand` namespace; for example the logo above is used as follows: `<img class="logo" src="${require('!!file-loader!<%= brand.product.logo.img %>')}">`

## Reskinning

### Requirements
To build the UI you will need the following installed on your build machine:
* java
* maven (please note, you will need version 3.5.2 or later)
* git
* bzip2
* libpng-devel
* automake     
* autoconf
* libtool
* dpkg
* pkgconfig
* nasm
* gcc

### Dev Build

For test purposes, you can build individual UI projects under `/ui-modules/` in `dev` mode as described in the `README` in those directories.
To apply a custom brand, set the environment variable `BROOKLYN_UI_BRAND_DIR` to point at the absolute path of the folder where your `brand.{properties,less}` files are.
For example to see what App Inspector looks like using the theme in `monochrome`, go to that project dir and run:

    BROOKLYN_UI_BRAND_DIR=/path/to/brooklyn-ui/ui-modules/branding/monochrome/ make dev

Notes:

* Consult the `README.md` in each dir for more info.  Typically the `dev` build expects the Brooklyn REST API to be running on `localhost:8081`.
* Although the `monochrome` example is located under `ui-modules`, it isn't used; it's intended as an example.
* Some changes may be picked up automatically but many might require a restart.


### Prod Build

The production build uses Maven.  Go to the `/ui-modules/` directory and run:

    mvn -Dbrooklyn.ui.brand.dir=/absolute/path/to/branding-dir clean install

The "/absolute/path/to/branding-dir" is the folder containing `brand.properties` and `brand.less` created above.

Please Note, the version of the bundles built should differ from the versions installed into Brooklyn to make them easier to identify 
and to prevent Karaf from ignoring them as duplicates.  
Typically this is done by appending a custom qualifier.
The simplest way to do this is to add `-Dbrooklyn.ui.version=${brooklyn.version}-custom` as part of the build,
on the command line (quoting to avoid bash variable expansion) or in a `.mvn/maven.config` file.
You can also use the `change-version.sh` script from https://github.com/apache/brooklyn-dist/tree/master/release/ :
e.g. `change-version.sh BROOKLYN <version>.custom <version>.your_company.1`, follwed by a rebuild. 

The build will create a KAR archive in `features/target/*.kar`.
This file can be copied to your Brooklyn install's `deploy/` directory prior to launching it, and your custom skin will automatically be deployed.
A ZIP or cloud/container image of Brooklyn can then be created (with this KAR archive in `deploy/`) to make a redistributable that can be installed on other machines.


## Embedding into a larger build project

In addition to the `.mvn/maven.config` suggestion above, defining the brand dir and the version qualifier, you may wish also to:

* have the larger project include a symlink to the `brooklyn-ui` and an aggregator project which
  builds the module `brooklyn-ui/ui-modules` with the maven defines as noted above
  (note that these system properties and env vars are the only way to pass data to aggregated maven modules where the parent hierarchy is different)

* have the larger project include a "precheck" module which uses the maven enforcer to check that variables are set
  (to prevent builds that don't have your branding and qualifier)

* set `-Dbrooklyn.ui.modularity.version=${brooklyn.version}` to use the standard Brooklyn modularity JARs
  (only the UI modules need rebuilding)

* set `-Dbuild.version=X.X.X` and `-Dbuild.name=Acme` to have that information reflected
  in selected pages of the UI (such as the "About" page).  This is in addition to defining custom branding and a custom qualifier on the Brooklyn version.

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
