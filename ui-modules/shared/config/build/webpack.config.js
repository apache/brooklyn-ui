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
const autoprefixer = require('autoprefixer');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const path = require('path');
const fs = require('fs');
const PropertiesReader = require('properties-reader');
const LessToJs = require('less-vars-to-js');
const pkg = require('./../../package.json');
const webpack = require('webpack');
const pj = path.join;

const ENV = process.env.NODE_ENV || 'development';
const ROOT_DIR = pj(path.resolve(__dirname), './../..');
const SRC_DIR = pj(ROOT_DIR, 'app');
const DEST_DIR = pj(ROOT_DIR, 'dist');
const NODE_MODULES_DIR = pj(ROOT_DIR, 'node_modules');
const UTILS_NODE_MODULES_DIR = pj(ROOT_DIR, '../utils/node_modules');
const BRAND_FALLBACK_DIR = pj(ROOT_DIR, '../branding');
const BRAND_DIR = (process.env.BROOKLYN_UI_BRAND_DIR && process.env.BROOKLYN_UI_BRAND_DIR!='default')
    // default accepted because mvn needs to pass a value and empty isn't allowed
    ? path.isAbsolute(process.env.BROOKLYN_UI_BRAND_DIR) 
      ? process.env.BROOKLYN_UI_BRAND_DIR 
      : pj(ROOT_DIR, process.env.BROOKLYN_UI_BRAND_DIR) 
    : pj(BRAND_FALLBACK_DIR, 'brooklyn');

const brandProps = PropertiesReader(path.resolve(BRAND_FALLBACK_DIR, 'brand.properties'));
brandProps.append(path.resolve(BRAND_DIR, 'brand.properties'));
const BRAND_IDENTIFIER = brandProps.get('brand-identifier');
if (!BRAND_IDENTIFIER) {
    throw("The brand.properties file in "+BRAND_DIR+" must specify a brand-identifier.");
}
var brandLess = {};
const getBrandedText = ((brandProps) => (key) => {
    var branded = key.split('.').reduce(function(o, x) {
        return o ? o[x] : undefined;
    }, brandProps);

    // TODO we should remove the "brooklyn" sections in package.json as a way of branding; 
    // always use the props above
    return branded ? branded : key.split('.').reduce(function(o, x) {
        return o ? o[x] : undefined;
    }, pkg.brooklyn);
});

const getStyleLoader = function() {
    var loader = [];
    loader.push('css' + (ENV === 'development' ? '?sourceMap' : ''));
    loader.push('postcss');

    const brandLessVars = LessToJs(fs.readFileSync(path.resolve(BRAND_DIR, 'brand.less'), 'utf8'));
    const brandLessVarsFromFallback = LessToJs(fs.readFileSync(path.resolve(BRAND_FALLBACK_DIR, 'brand.less'), 'utf8'));
    var brandLessVarsFromProps = brandProps.getByRoot('less');
    Object.assign(brandLess, brandLessVarsFromFallback, brandLessVarsFromProps, brandLessVars);
    brandLess['brand-identifier'] = BRAND_IDENTIFIER;

    var lessConfig = { modifyVars: brandLess };
    
    if (ENV === 'development') {
        lessConfig.sourceMap = true;
    }
    loader.push('less?' + JSON.stringify(lessConfig));

    return loader.join('!');
};

console.log('Build with:', 'ENV', ENV, '-', 'brand-identifier', BRAND_IDENTIFIER);

const config = {
    context: SRC_DIR,
    entry: {
        index: [
            'babel-polyfill',
            'index.less',
            'index.js'
        ]
    },
    output: {
        filename: '[name].[hash].js',
        path: DEST_DIR
    },
    module: {
        loaders: [{
            test: /\.js$/i,
            exclude: /node_modules/,
            loader: 'babel',
            query: { 
              presets: [
                'babel-preset-env',
                'babel-preset-stage-0',
              ].map(require.resolve) 
            }
        }, {
            test: /\.less$/,
            exclude: /index.less/,
            loader: getStyleLoader()
        }, {
            test: /index.less$/,
            loader: ExtractTextPlugin.extract(getStyleLoader())
        }, {
            test: /\.(jpe?g|png|gif)$/i,
            loaders: [
                'url-loader?limit=50000&name=assets/[name].[hash].[ext]',
                'image-webpack'
            ]
        }, {
            test: /\.(woff|svg|ttf|eot)([\?]?.*)$/,
            loader: 'file-loader?name=assets/[name].[hash].[ext]'
        }, {
            test: /\.json$/,
            loader: 'raw-loader'
        }, {
            test: /\.html$/,
            loader: 'html?interpolate&-minimize&attrs[]=img:src&attrs[]=img:data-src&attrs[]=object:data'
        }]
    },
    resolve: {
        alias: {
            'brooklyn-shared': path.resolve(ROOT_DIR, '../shared'),
            // user-supplied brand dir for overwrites (defaults to brooklyn brand)
            'brand': BRAND_DIR,
            // fallback branding info
            'brand-fallback': BRAND_FALLBACK_DIR,
            // brand-supplied JS definitions
            'brand-js': fs.existsSync(pj(BRAND_DIR, 'brand.js')) ? pj(BRAND_DIR, 'brand.js') : pj(BRAND_FALLBACK_DIR, 'brand.js'),
        },
        root: SRC_DIR,
        extensions: ['', '.js'],
        modulesDirectories: [
            NODE_MODULES_DIR,
            UTILS_NODE_MODULES_DIR
        ]
    },
    resolveLoader: {
        root: [NODE_MODULES_DIR],
        modulesDirectories: [
            NODE_MODULES_DIR,
            UTILS_NODE_MODULES_DIR
        ]
    },
    postcss: [
        autoprefixer({
            browsers: ['last 2 versions']
        })
    ],
    ejsHtml: {
        // a "brooklyn" section in package.json can contain extra info like `product.name` and `appname`
        app: pkg.brooklyn,
        brand: brandProps.path(),
        getBrandedText: getBrandedText(brandProps.path())
    },
    plugins: [
        new ExtractTextPlugin('[name].[chunkhash].css'),
        new webpack.optimize.OccurenceOrderPlugin(),
        new webpack.DefinePlugin({
            __BROOKLYN_VERSION__: JSON.stringify(process.env.BROOKLYN_VERSION || '1.0.0-SNAPSHOT'),
            __BUILD_NAME__: JSON.stringify(process.env.BUILD_NAME),
            __BUILD_VERSION__: JSON.stringify(process.env.BUILD_VERSION),
            __BUILD_BRANCH__: JSON.stringify(process.env.BUILD_BRANCH),
            __BUILD_COMMIT_ID__: JSON.stringify(process.env.BUILD_COMMIT_ID),
            // from bootstrap, possibly overridden, included here for access from JS
            __BRAND_SUCCESS__: JSON.stringify(brandLess['@brand-success'] || '#5cb85c'),
            __BRAND_DANGER__: JSON.stringify(brandLess['@brand-danger'] || '#d9534f'),
            'process.env.NODE_ENV': JSON.stringify(ENV),
            // used by brBrandInfo.getBrandedText
            __BRAND_PROPS__: JSON.stringify(brandProps.path()),
        }),
        new webpack.ProvidePlugin({
            'Promise': 'imports?this=>global!exports?global.Promise!es6-promise'
        }),
        new HtmlWebpackPlugin({
            template: 'ejs-html!' + pj(SRC_DIR, 'index.html'),
            chunksSortMode: 'dependency'
        }),
        new webpack.optimize.CommonsChunkPlugin({
            name: 'vendor',
            minChunks: function (module) {
                // This prevents stylesheet resources with the .css or .scss extension
                // from being moved from their original chunk to the vendor chunk
                if (module.resource && (/^.*\.(css|scss|less)$/).test(module.resource)) {
                    return false;
                }
                return module.context && module.context.indexOf('node_modules') !== -1;
            }
        }),
        new webpack.optimize.CommonsChunkPlugin({
            name: 'manifest',
            minChunks: Infinity
        })
    ]
};

if (fs.existsSync(pj(BRAND_DIR, 'build-config-tweak.js'))) {
  eval(""+fs.readFileSync(pj(BRAND_DIR, 'build-config-tweak.js')));
}

if (ENV === 'development') {
    config.watch = true;
    config.debug = true;
    config.devtool = 'source-map';
    config.entry.index.push('webpack-hot-middleware/client');
    config.plugins.push(new webpack.HotModuleReplacementPlugin())
} else {
    config.plugins.push(
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin({
            mangle: false,
            compress: {
                dead_code: true,
                unused: true,
                warnings: false
            }
        }),
        new webpack.BannerPlugin(getBrandedText(brandProps.path())("banner"))
    )
}

module.exports = config;
