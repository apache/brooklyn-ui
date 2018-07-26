#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
default: dev

build:
	@echo "Building production bundle..."
	NODE_ENV="production" npm run build

clean:
	@echo "Cleaning modules..."
	@rm -rf ./node_modules

dev:
	@echo "Starting dev web server..."
	@npm start

server: build
	@echo "Starting api proxy server..."
	NODE_ENV="production" npm start

install:
	@echo "Installing npm modules..."
	@npm install

test:
	@echo "Running tests..."
	@npm test

setup: clean install

war:
	@mvn clean install

.PHONY: build clean deploy dev install server setup test war
