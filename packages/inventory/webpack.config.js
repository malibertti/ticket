const { IgnorePlugin } = require('webpack');
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');
const { PinoWebpackPlugin } = require('pino-webpack-plugin');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new IgnorePlugin({ resourceRegExp: /^aws-sdk$/ }),
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
    }),
    new PinoWebpackPlugin({ transports: ['pino-pretty'] }),
    {
      apply(compiler) {
        for (const rule of compiler.options.module.rules) {
          if (rule?.loader?.includes('source-map-loader')) {
            rule.exclude = /node_modules/;
          }
        }
      },
    },
  ],
};
