// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
({
    // The entry point to the application. Brooklyn's is in config.js.
    name: "config",
    baseUrl: "${project.build.webapp}/assets/js",
    mainConfigFile: "${project.build.webapp}/assets/js/config.js",
    paths: {
        // Include paths to external resources (e.g. on a CDN) here.

        // Optimiser looks for js/requireLib.js by default.
        "requireLib": "libs/require"
    },

    // Place the optimised file in target/<war>/assets.
    out: "${project.build.webapp}/assets/js/gui.all.min.js",

    // Set to "none" to skip minification
    optimize: "uglify"
})

