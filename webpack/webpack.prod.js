const { merge } = require('webpack-merge');
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const common = require('./webpack.common.js');

// 创建不同格式输出的通用配置（非ESM）
const createConfig = (filename, minimize) => merge(common, {
  mode: 'production',
  devtool: 'source-map',
  output: {
    filename,
    path: path.resolve(__dirname, '../dist'),
    library: {
      name: 'MEditor',
      type: 'umd',
      export: 'default'
    },
    umdNamedDefine: true,
    globalObject: 'this'
  },
  optimization: {
    minimize,
    minimizer: [new TerserPlugin({
      extractComments: false,
      terserOptions: {
        format: {
          comments: false,
        },
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      },
    })],
  }
});

// 创建ESM配置（不需要库名称）
const createEsmConfig = (filename, minimize) => merge(common, {
  mode: 'production',
  devtool: 'source-map',
  output: {
    filename,
    path: path.resolve(__dirname, '../dist'),
    library: {
      type: 'module'
      // ESM格式不需要name属性
    },
    globalObject: 'this'
  },
  experiments: {
    outputModule: true
  },
  optimization: {
    minimize,
    minimizer: [new TerserPlugin({
      extractComments: false,
      terserOptions: {
        format: {
          comments: false,
        },
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      },
    })],
  }
});

// 决定要构建的文件版本
const multipleConfigs = [
  // UMD 压缩版 (浏览器生产版)
  createConfig('m-editor.min.js', true),
  // UMD 非压缩版 (开发调试用)
  createConfig('m-editor.js', false),
  // ESM 模块版本 - 使用专门的ESM配置
  createEsmConfig('m-editor.esm.js', true),
  // CommonJS 版本
  merge(createConfig('m-editor.common.js', true), {
    output: {
      library: {
        type: 'commonjs2'
      }
    }
  }),
];

// 只在第一个配置中添加清理插件，避免重复清理
multipleConfigs[0].plugins.push(new CleanWebpackPlugin());

module.exports = multipleConfigs;
