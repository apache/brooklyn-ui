#/bin/sh

# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

function checkCorrectVersion() {
    if ! echo "${!1}" | grep -q -e "^[0-9]\+\(\.[0-9]\+\)\{2\}$";
    then
        echo "Value for ${1} is incorrect, expected A.B.C actual \"${!1}\""
        exit 1
    fi
}

if [ -z "${RELEASE_VERSION}" -o -z "${NEXT_RELEASE_VERSION}" ];
then
    echo "Usage : RELEASE_VERSION=1.0.0 NEXT_RELEASE_VERSION=1.0.1 $0"
    exit 1
fi

checkCorrectVersion RELEASE_VERSION
checkCorrectVersion NEXT_RELEASE_VERSION

NEXT_DEV_VERSION=${NEXT_RELEASE_VERSION}-SNAPSHOT
RELEASE_BRANCH="uss-release-${RELEASE_VERSION}"
RELEASE_TAG="USS-${RELEASE_VERSION}"
SCRIPT_DIR="$(dirname $0)"

cd "${SCRIPT_DIR}/.."

failOnError() {
    if [ $? -ne 0 ]; then
        echo -e "\\n$@\\n"
        exit 1
    fi
}

# Revert potential build modifications
git reset --hard HEAD
failOnError "Unable reset local changes"

# Create release branch
git checkout -b "${RELEASE_BRANCH}"
failOnError "Unable to checkout the release branch"

# Set release version
mvn versions:set -DnewVersion=${RELEASE_VERSION} -DgenerateBackupPoms=false
failOnError "Unable set the release version"

# Commit the change
git commit -am "Create new release version ${RELEASE_VERSION}"
failOnError "Unable to commit the release version"

# Tag the version
git tag "${RELEASE_TAG}"
failOnError "Unable to create the release tag"

# Build the release
mvn clean install
failOnError "Error detected during the build of the release"

# Deploy the blueprint-composer released
cd ui-modules/blueprint-composer/ && mvn deploy && cd -
failOnError "Unable to deploy the blueprint-composer released"

# Revert potential build modifications
git reset --hard HEAD
failOnError "Unable reset local changes"

# Set new development version
mvn versions:set -DnewVersion=${NEXT_DEV_VERSION} -DgenerateBackupPoms=false
failOnError "Unable set the next development version"

# Commit the change
git commit -am "Prepare next development version ${NEXT_DEV_VERSION}"
failOnError "Unable to commit the next development version"

# Push all change to remote repository
git push origin "${RELEASE_BRANCH}"
failOnError "Unable to push the release branch"

# Push tag to remote repository
git push origin "${RELEASE_TAG}"
failOnError "Unable to push the release tag"

