import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
const license = readFileSync(path.resolve(__dirname, 'LICENSE.md'), 'utf8');

const bannerComment = `/*! ${pkg.name}.js ${pkg.version}\n\n${license}\n */`;
// The UMD wrapper captures `module.exports` from the IIFE output.
// This depends on lib/index.ts using `module.exports = ...` (CJS).
// If that file is ever changed to `export default`, the wrapper will
// silently produce an empty `Twilio.Video` object.
const umdHeader = `${bannerComment}
(function(root) {
  var module = { exports: {} };
  var exports = module.exports;
`;
const umdFooter = `
  module.exports = __twilio_video;
  var Video = module.exports;
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return Video; });
  } else {
    var Twilio = root.Twilio = root.Twilio || {};
    Twilio.Video = Twilio.Video || Video;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
`;

const browserPlugins = (minify = false) => [
  alias({
    entries: [
      { find: 'ws', replacement: path.resolve(__dirname, 'src/ws.js') },
    ],
  }),
  resolve({
    browser: true,
    preferBuiltins: false,
  }),
  commonjs(),
  json(),
  ...(minify ? [terser()] : []),
];

export default [
  // Browser bundle (dist/twilio-video.js)
  {
    input: 'es5/index.js',
    output: {
      file: 'dist/twilio-video.js',
      format: 'iife',
      name: '__twilio_video',
      banner: umdHeader,
      footer: umdFooter,
      sourcemap: false,
      exports: 'auto',
      strict: false,
    },
    plugins: browserPlugins(false),
  },

  // Minified browser bundle (dist/twilio-video.min.js)
  {
    input: 'es5/index.js',
    output: {
      file: 'dist/twilio-video.min.js',
      format: 'iife',
      name: '__twilio_video',
      banner: umdHeader,
      footer: umdFooter,
      sourcemap: false,
      exports: 'auto',
      strict: false,
    },
    plugins: browserPlugins(true),
  },
];
