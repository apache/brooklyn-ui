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
const PRODUCTION_BUILD = process.env.NODE_ENV === 'production';
const webpackConfig = require('./webpack.config');

module.exports = function (config) {
    const conf = {
        basePath: '',
        frameworks: ['jasmine'],
        files: [
            {pattern: './karma.test.shim.js', watched: false}
        ],
        preprocessors: {
            './karma.test.shim.js': ['webpack', 'sourcemap']
        },
        webpack: Object.assign({}, webpackConfig, {entry: undefined}),
        webpackMiddleware: {
            stats: 'errors-only'
        },
        webpackServer: {
            noInfo: true
        },
        exclude: [],
        colors: !PRODUCTION_BUILD,
        logLevel: config.LOG_INFO,
        autoWatch: !PRODUCTION_BUILD,
        singleRun: PRODUCTION_BUILD,
        reporters: ['progress'],
        browsers: ['PhantomJS'],
        plugins: [
            require('karma-webpack'),
            require('karma-sourcemap-loader'),
            'karma-jasmine',
            'karma-phantomjs-launcher'
        ]
    };
    config.set(conf);
};