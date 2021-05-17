# Brooklyn UI Modules

## Getting started

Each of the module UI projects in this directory has a `Makefile` to make working with it easier.

To install node dependencies (and anytime things get out of sync, to wipe `node_modules` in the local dir and the `../utils`;
also see `local_clean` and `local_install` if you know `../utils` is updated and want to skip that update):

```sh
make clean install
```

To run a local development server:
```sh
make
```

The server will be located at [http://0.0.0.0:8080](http://0.0.0.0:8080) and it will be proxy all API calls to Brooklyn Server 
which you shuld run before on default for Brooklyn 8081 port. After that any chages detected in project file system will 
automaticly refresh application via Webpack HMR (Hot Module Replacement) without hard reload page.

To build the production bundle, just run:

```sh
make build
```

The bundle will be placed in `/target` directory.

To run the production bundle with an API proxy server:

```sh
make server
```

To change default settings via environment variables, for example port number, create `.env` file in project root folder:
```
API_HOSTNAME="0.0.0.0"
API_PORT=8081
API_PATH="/v1/"
PORT=8080
HOSTNAME="0.0.0.0"
```

Or just run any `make` or `npm` command with env prefix variable to change it in place, for example:
```
API_PORT=8080 PORT=80 make server
```

Branding/skinning settings can also be applied, as per those documents. For example:

```sh
BROOKLYN_UI_BRAND_DIR=/path/to/brooklyn-ui/ui-modules/branding/monochrome/ make
```

## Running tests

The project comes with 2 kinds of tests:
* unit tests
* end-to-end tests

To unit test, just run:
```sh
npm test
```

For the end-to-end tests, you need first to have [protractor installed and setup](http://www.protractortest.org/#/tutorial). 
You also need to have the UI module running locally, as well as the Brooklyn server. Then, just run:
```sh
npm run e2e
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
