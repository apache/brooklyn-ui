# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

# For Brooklyn UI, we use a debian distribution instead of alpine as there are some libgcc incompatibilities with PhantomJS
# Maven 3.9 + Amazon Corretto 8. The 3.8 tags (e.g. maven:3.8-amazoncorretto-8-debian) have not
# been updated since 2023-12 (Maven 3.8 is EOL), so they get no OS security patches.
FROM maven:3.9-amazoncorretto-8-debian

# Install necessary binaries to build brooklyn-ui
#  - git, make, gcc/g++, python3: node-gyp native modules (e.g. fibers)
#  - autoconf/automake/libtool/nasm/pkg-config/libpng-dev/zlib1g-dev: imagemin *-bin packages
#    compile from source when no prebuilt binary exists (always the case on arm64)
#  - bzip2, libfontconfig1: phantomjs-prebuilt install and runtime (most karma configs)
#  - chromium: ChromeHeadless for karma (ui-modules/utils)
RUN apt-get update && apt-get install -y \
    git \
    libpng-dev \
    libjpeg-turbo-progs \
    zlib1g-dev \
    pngquant \
    make \
    automake \
    autoconf \
    libtool \
    dpkg \
    pkg-config \
    nasm \
    gcc \
    g++ \
    python3 \
    bzip2 \
    libfontconfig1 \
    chromium \
 && rm -rf /var/lib/apt/lists/*

# Use the distro Chromium for karma-chrome-launcher; stop puppeteer downloading its own x64-only build.
# Chromium's sandbox needs user namespaces, which containers (e.g. on Jenkins) don't allow, so karma
# starts it through a wrapper that adds --no-sandbox.
RUN printf '#!/bin/sh\nexec /usr/bin/chromium --no-sandbox "$@"\n' > /usr/local/bin/chromium-no-sandbox \
 && chmod 755 /usr/local/bin/chromium-no-sandbox
ENV CHROME_BIN=/usr/local/bin/chromium-no-sandbox
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Make sure the /.config && /.yarn (for UI module builds) is writable for all users
RUN mkdir -p /.config && chmod -R 777 /.config
RUN mkdir -p /.yarn && chmod -R 777 /.yarn

# Make sure the /var/maven is writable for all users
RUN mkdir -p /var/maven/.m2/ && chmod -R 777 /var/maven/
ENV MAVEN_CONFIG=/var/maven/.m2
# PhantomJS workaround; can go once all karma configs use ChromeHeadless
ENV OPENSSL_CONF=/etc/ssl
