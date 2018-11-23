/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

pipeline {
    agent any
    environment {
        RELEASE_BRANCH   = "uss-release-${RELEASE_VERSION}"
        RELEASE_TAG      = "USS-${RELEASE_VERSION}"
        NEXT_DEV_VERSION = "${NEXT_RELEASE_VERSION}-SNAPSHOT"
    }
    stages {
        stage('Create release branch') {
            steps {
                script {
                    sh 'git checkout -b "${RELEASE_BRANCH}"'
                }
            }
        }
        stage('Set release version') {
            steps {
                script {
                    sh 'mvn versions:set -DnewVersion=${RELEASE_VERSION} -DgenerateBackupPoms=false'
                    sh 'git commit -am "Create new release version ${RELEASE_VERSION}"'
                }
            }
        }
        stage('Tag release') {
            steps {
                script {
                    sh 'git tag "${RELEASE_TAG}"'
                }
            }
        }
        stage('Build release') {
            steps {
                script {
                    sh 'mvn clean install'
                }
            }
            post {
                always {
                    script {
                        archiveArtifacts '**/target/*.xml,**/target/rat.txt'
                    }
                }
            }
        }
        stage('Deploy blueprint-composer to maven repository') {
            steps {
                script {
                    sh 'cd ui-modules/blueprint-composer/ && mvn deploy && cd -'
                }
            }
        }
        stage('Set new development version') {
            steps {
                script {
                    sh 'git reset --hard HEAD'
                    sh 'mvn versions:set -DnewVersion=${NEXT_DEV_VERSION} -DgenerateBackupPoms=false'
                    sh 'git commit -am "Prepare next development version ${NEXT_DEV_VERSION}"'
                }
            }
        }
        stage('Push git change to remote server') {
            steps {
                script {
                    sh 'git push origin "${RELEASE_BRANCH}"'
                    sh 'git push origin "${RELEASE_TAG}"'
                }
            }
        }
    }
}

