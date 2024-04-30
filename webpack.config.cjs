const path = require("node:path");
const builtins = require("builtin-modules");
const webpack = require("webpack");

module.exports = {
  mode: "development",
  entry: "./main.ts",
  output: {
    path: path.resolve(__dirname),
    filename: "./main.js",
    libraryTarget: 'commonjs2',
  },
  module: {
    rules: [
      { test: /\.ts$/, use: "ts-loader" },
      { test: /\.wasm$/, use: "wasm-loader" },
    ],
  },
  externals: {
    obsidian: "commonjs obsidian",
    electron: "commonjs electron",
    "@codemirror/autocomplete": "commonjs @codemirror/autocomplete",
    "@codemirror/collab": "commonjs @codemirror/collab",
    "@codemirror/commands": "commonjs @codemirror/commands",
    "@codemirror/language": "commonjs @codemirror/language",
    "@codemirror/lint": "commonjs @codemirror/lint",
    "@codemirror/search": "commonjs @codemirror/search",
    "@codemirror/state": "commonjs @codemirror/state",
    "@codemirror/view": "commonjs @codemirror/view",
    "@lezer/common": "commonjs @lezer/common",
    "@lezer/highlight": "commonjs @lezer/highlight",
    "@lezer/lr": "commonjs @lezer/lr",
    ...builtins.reduce((acc, builtin) => {
      acc[builtin] = `commonjs ${builtin}`;
      return acc;
    }, {}),
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    alias: {
      sharp: false,
      'onnxruntime-node': false,
    },
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
};
