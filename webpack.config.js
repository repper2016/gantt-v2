const { VueLoaderPlugin } = require('vue-loader');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[chunkhash:8].js',
    chunkFilename: '[name].[chunkhash:8].chunk.js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          cacheDirectory: path.resolve(__dirname, 'node_modules/.cache/vue-loader'),
          compilerOptions: {
            preserveWhitespace: false
          }
        }
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          cacheDirectory: path.resolve(__dirname, 'node_modules/.cache/babel-loader'),
          cacheCompression: false
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', {
          loader: 'css-loader',
          options: {
            importLoaders: 1
          }
        }]
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      }
    }),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        BASE_URL: JSON.stringify('/')
      }
    })
  ],
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.esm.js',
      '@': path.resolve(__dirname, 'src')
    },
    extensions: ['*', '.js', '.vue', '.json']
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      maxSize: 244000, // 244KB limit
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
          reuseExistingChunk: true,
          maxSize: 500000 // 500KB for vendor chunk
        },
        elementUI: {
          name: 'element-ui',
          test: /[\\/]node_modules[\\/]element-ui[\\/]/,
          chunks: 'all',
          priority: 20,
          reuseExistingChunk: true,
          maxSize: 200000 // 200KB for Element UI
        },

        ganttComponents: {
          name: 'gantt-components',
          test: /[\\/]src[\\/]components[\\/].*Gantt.*\.vue$/,
          chunks: 'all',
          priority: 12,
          reuseExistingChunk: true,
          maxSize: 300000 // 300KB for Gantt components
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 5,
          reuseExistingChunk: true,
          maxSize: 150000 // 150KB for common chunks
        }
      }
    },
    runtimeChunk: {
      name: 'runtime'
    },
    // 更好的模块合并
    concatenateModules: true,
    // 标记副作用
    sideEffects: false
  },
  cache: {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, 'node_modules/.cache/webpack'),
    buildDependencies: {
      config: [__filename]
    }
  },
  devServer: {
    host: 'localhost',
    port: 8080,
    historyApiFallback: true,
    hot: true,
    open: false,
    compress: true,
    watchFiles: {
      paths: ['src/**/*'],
      options: {
        usePolling: false,
        interval: 1000
      }
    },
    client: {
      overlay: {
        errors: true,
        warnings: false
      }
    }
  },

  // 性能配置
  performance: {
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
    maxAssetSize: 250000, // 250KB
    maxEntrypointSize: 250000, // 250KB
    assetFilter: function(assetFilename) {
      // 只对 JS 和 CSS 文件进行大小检查
      return /\.(js|css)$/.test(assetFilename);
    }
  }
};
