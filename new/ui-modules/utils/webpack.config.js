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
const path = require('path');
const webpack = require('webpack');

const pj = path.join;

const ENV = process.env.NODE_ENV || 'development';
const ROOT_DIR = path.resolve(__dirname);
const SRC_DIR = pj(ROOT_DIR, 'app');
const DEST_DIR = pj(ROOT_DIR, 'dist');

console.log('Build with:', ENV, 'env');

const config = {
    context: SRC_DIR,
    output: {
        filename: '[name].js',
        path: DEST_DIR
    },
    module: {
        loaders: [{
            test: /\.js$/i,
            exclude: /node_modules/,
            loader: 'babel-loader',
            query: { presets: [
                'babel-preset-env',
                'babel-preset-stage-0',
            ].map(require.resolve) }
        }]
    }
};

module.exports = config;
