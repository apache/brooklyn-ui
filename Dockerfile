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
FROM maven:3.8.6-jdk-8

# Install necessary binaries to build brooklyn-ui
RUN apt-get update && apt-get install -y git-core \
    libpng-dev \
    libjpeg-progs \
    pngquant \
    make \
    automake \
    autoconf \
    libtool \
    dpkg \
    pkg-config \
    nasm \
    gcc

# Make sure the /.config && /.npm (for UI module builds) is writable for all users
RUN mkdir -p /.config && chmod -R 777 /.config
RUN mkdir -p /.npm && chmod -R 777 /.npm

# Make sure the /var/maven is writable for all users
RUN mkdir -p /var/maven/.m2/ && chmod -R 777 /var/maven/
ENV MAVEN_CONFIG=/var/maven/.m2
ENV OPENSSL_CONF=/etc/ssl
