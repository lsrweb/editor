const { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  output: {
    filename: 'm-editor.js',
    path: path.resolve(__dirname, '../dist'),
    library: {
      name: 'MEditor',
      type: 'umd',
      export: 'default'
    },
    umdNamedDefine: true,
    globalObject: 'this'
  },
  devServer: {
    static: {
      directory: path.join(__dirname, '../public'),
    },
    port: 9000,
    hot: true,
    open: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, '../public/index.html'),
      title: 'MEditor Demo'
    })
  ]
});
