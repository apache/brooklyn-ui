# [![**Brooklyn**](https://brooklyn.apache.org/style/img/apache-brooklyn-logo-244px-wide.png)](http://brooklyn.apache.org/)

### Apache Brooklyn UI Sub-Project

This repo contains the JavaSciprt UI for Apache Brooklyn plus server-side code to enable module lookup and discovery.

Essential contents:

* `modularity-server`:  Java OSGi modules to facilitate registering and discovering available modules
* `ui-modules`: Individual Angular JS modules -- each can be run as a standalone Node app,
  or built as OSGi bundle including the WAR to be served collectively by an OSGi server
  (each using the modularity server-side endpoints to find available modules and allow navigation between them,
  and the  `home` module providing a convenient entry point)
* `features`: Build an OSGi feature


### Building the project

Two methods are available to build this project: within a docker container or directly with maven.

#### Using docker

The project comes with a `Dockerfile` that contains everything you need to build this project.
First, build the docker image:

```bash
docker build -t brooklyn:ui .
```

Then run the build:

```bash
docker run -i --rm --name brooklyn-ui -v ${HOME}/.m2:/root/.m2 -v ${PWD}:/usr/build -w /usr/build brooklyn:ui mvn clean install
```

### Using maven

You will need the following binaries installed first:
* `java`
* `maven` (please note, you will need version 3.5.2 or later)
* `git`
* `bzip2`
* `libpng`. This has different package names based on the distribution:
  * `libpng-devel` for centos
  * `libpng-dev` for debian/ubuntu (also requires `libpng12`)
  * `libpng` for MacOS

_Optional, only if the `libpng` cannot be found_
* _`automake (opt)`_    
* _`autoconf`_
* _`libtool`_
* _`dpkg`_
* _`pkgconfig`_
* _`nasm`_
* _`gcc`_

With this, simply run:

```bash
mvn clean install
```


## Dev

Instructions for developing UI modules is included in subdirectories, but in short all you need to do once things are configured
is to run `make` in the relevant module directory, with a Brooklyn REST server on 8081.


## Documentation

For developers, the following links may be useful:

* [Overview and architecture of the project](docs/overview.md)
* [Building individual module / Dev environment](ui-modules/home/README.md)
* [Skinning the UI with custom themes](docs/skinning.md)
* [Customizing and embedding the UI](docs/customizations.md)


## Troubleshooting

### Build Failure (Cached Dependencies)

The first time `mvn clean install` or `npm build` is run, it will cache dependencies in `node_modules`.
If a dependency is subsequently upgraded, this could cause an incompatibility. For example, it can cause
a test failure such as:

    20 06 2018 17:28:41.143:ERROR [karma]: { Error: spawn ENOTDIR
        at ChildProcess.spawn (internal/child_process.js:357:11)
        at spawn (child_process.js:528:9)
        at spawnWithoutOutput (/Users/aledsage/repos/apache/brooklyn/brooklyn-ui/ui-modules/utils/node_modules/karma/lib/launchers/process.js:141:24)

The fix is to delete the auto-generated `node_modules` directories:

```bash
cd /path/to/brooklyn_ui
find ./ -type d -name "node_modules" -exec rm -rf {} \+
```

### Docker Build Failure (Dependencies for Wrong Architecture)

When the build is run locally, it will download executables such as `phantomjs`, for the
local architecture. If the build is subsequently run in a Docker container, mounting the
local repo directory, it may be incompatible. An example error is:

```
[INFO] 25 06 2018 15:26:48.224:ERROR [launcher]: PhantomJS stdout:
[INFO] 25 06 2018 15:26:48.224:ERROR [launcher]: PhantomJS stderr: /usr/build/ui-modules/utils/node_modules/phantomjs-prebuilt/lib/phantom/bin/phantomjs: 1: /usr/build/ui-modules/utils/node_modules/phantomjs-prebuilt/lib/phantom/bin/phantomjs: Syntax error: Unterminated quoted string
```

You can check the file type by running:

```bash
file ./ui-modules/utils/node_modules/phantomjs-prebuilt/lib/phantom/bin/phantomjs

./ui-modules/ui-utils/node_modules/phantomjs-prebuilt/lib/phantom/bin/phantomjs: Mach-O 64-bit executable x86_64
```

The fix is to delete the auto-generated `node_modules` directories:

```bash
cd /path/to/brooklyn_ui
find ./ -type d -name "node_modules" -exec rm -rf {} \+
```

### Test Failure (PhantomJS)

Developers have experienced occassional test failures like:

```
[INFO] 26 06 2018 09:33:31.658:INFO [karma]: Karma v1.7.1 server started at http://0.0.0.0:9876/
[INFO] 26 06 2018 09:33:31.662:INFO [launcher]: Launching browser PhantomJS with unlimited concurrency
[INFO] 26 06 2018 09:33:31.707:INFO [launcher]: Starting browser PhantomJS
[INFO] 26 06 2018 09:33:41.858:INFO [PhantomJS 2.1.1 (Linux 0.0.0)]: Connected on socket 9qL2Zvu8cceP9O7ZAAAA with id 75060365
[INFO] 26 06 2018 09:33:52.659:WARN [PhantomJS 2.1.1 (Linux 0.0.0)]: Disconnected (1 times), because no message in 10000 ms.
[INFO] PhantomJS 2.1.1 (Linux 0.0.0) ERROR
[INFO]   Disconnected, because no message in 10000 ms.
[INFO]
[INFO]
[ERROR] npm ERR! Test failed.  See above for more details.
...
[ERROR] Failed to execute goal com.github.eirslett:frontend-maven-plugin:1.3:npm (npm test) on project brooklyn-ui-utils: Failed to run task: 'npm test' failed. (error code 1) -> [Help 1]
[ERROR]
[ERROR] To see the full stack trace of the errors, re-run Maven with the -e switch.
[ERROR] Re-run Maven using the -X switch to enable full debug logging.
[ERROR]
[ERROR] For more information about the errors and possible solutions, please read the following articles:
[ERROR] [Help 1] http://cwiki.apache.org/confluence/display/MAVEN/MojoFailureException
[ERROR]
[ERROR] After correcting the problems, you can resume the build with the command
[ERROR]   mvn <goals> -rf :brooklyn-ui-utils
```

This appears to be a non-deterministic environment issue. The workaround is to rerun the test,
resuming the build from the failed module. For example:

```bash
mvn clean install -rf :brooklyn-ui-utils
```


### Docker Build Failure on OS X (no such file)

Developers have experienced build failures on OS X like:

```
[ERROR] npm ERR! path /usr/build/ui-modules/app-inspector/node_modules/d3-dsv/bin/json2dsv
[ERROR] npm ERR! code ENOENT
[ERROR] npm ERR! errno -2
[ERROR] npm ERR! syscall chmod
[ERROR] npm ERR! enoent ENOENT: no such file or directory, chmod '/usr/build/ui-modules/app-inspector/node_modules/d3-dsv/bin/json2dsv'
[ERROR] npm ERR! enoent This is related to npm not being able to find a file.
[ERROR] npm ERR! enoent
[ERROR]
[ERROR] npm ERR! A complete log of this run can be found in:
[ERROR] npm ERR!     /root/.npm/_logs/2018-07-09T17_46_07_187Z-debug.log
```

This is Docker bug: https://github.com/docker/for-mac/issues/2296.

Try rerunning the build from the failed module (but this will not always work). For example:

```bash
pushd ui-modules/app-inspector
find ./ -type d -name "node_modules" -exec rm -rf {} \+
popd
mvn clean install -rf :brooklyn-ui-app-inspector
```

Alternatively, run Docker on a Linux VM (e.g. see instructions at
https://docs.docker.com/install/linux/docker-ce/centos/#install-docker-ce).

```bash
###
 # Install Docker
 ##
sudo yum install -y yum-utils \
  device-mapper-persistent-data \
  lvm2
sudo yum-config-manager \
    --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo

sudo yum install docker-ce

# Or if you hit https://github.com/docker/for-linux/issues/20#issuecomment-312760808
#sudo yum install --setopt=obsoletes=0 \
#    docker-ce-17.03.2.ce-1.el7.centos.x86_64 \
#    docker-ce-selinux-17.03.2.ce-1.el7.centos.noarch

sudo systemctl start docker

###
 # Download the Brooklyn UI code
 ##
sudo yum install -y git-core
git clone https://github.com/apache/brooklyn-ui.git
cd brooklyn-ui/

###
 # Build.
 ##
docker build -t brooklyn:ui .
docker run -i --rm --name brooklyn-ui -v ${HOME}/.m2:/root/.m2 -v ${PWD}:/usr/build -w /usr/build brooklyn:ui mvn clean install
```

### Dockerfile Development

The Dockerfile should work for you. The notes below are for if you are trying to tweak the
Dockerfile. The dependencies (e.g. `make`) are to allow npm to build particular modules
from source. Without this, it gives an error like:

```
[ERROR]   ⚠ The `/usr/build/ui-modules/home/node_modules/mozjpeg/vendor/cjpeg` binary doesn't seem to work correctly
[ERROR]   ⚠ mozjpeg pre-build test failed
[ERROR]   ℹ compiling from source
[ERROR]   ✖ Error: autoreconf -fiv && ./configure --disable-shared --prefix="/usr/build/ui-modules/home/node_modules/mozjpeg/vendor" --bindir="/usr/build/ui-modules/home/node_modules/mozjpeg/vendor" --libdir="/usr/build/ui-modules/home/node_modules/mozjpeg/vendor" && make --jobs=4 && make install --jobs=4
[ERROR] Command failed: make --jobs=4
[ERROR] /bin/sh: 1: make: not found
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
