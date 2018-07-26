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
const config = require('./build/webpack.config.js');
const dotenv = require('dotenv');
const express = require('express');
const proxy = require('proxy-middleware');
const url = require('url');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');

dotenv.config({silent: true});

const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
const PORT = process.env.PORT || 8080;
const API_HOSTNAME = process.env.API_HOSTNAME || HOSTNAME;
const API_PORT = process.env.API_PORT || '8081';
const API_PATH = process.env.API_PATH || '/v1/';

const ENV = process.env.NODE_ENV || 'development';
const DEV = ENV === 'development';

const app = express();
const compiler = webpack(config);

app.use(API_PATH, proxy(
    url.parse(`http://${API_HOSTNAME}:${API_PORT}${API_PATH}`)
));

if (DEV) {
    app.use(
        webpackDevMiddleware(compiler, {
            contentBase: config.output.path,
            host: HOSTNAME,
            inline: true,
            noInfo: true,
            port: PORT,
            publicPath: config.output.publicPath
        })
    );
    app.use(webpackHotMiddleware(compiler))
} else {
    app.use(express.static(config.output.path))
}

app.listen(PORT, (err) => {
    if (err) {
        console.error(err)
    } else {
        var url = `http://${HOSTNAME}`;

        if (PORT !== 80) {
            url = url + `:${PORT}`
        }

        console.info(`==> 🌎  Running server with ${ENV} bundle. Open up ${url} in your browser.`)
    }
});
