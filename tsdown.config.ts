import { defineConfig } from 'tsdown';
import fs from 'fs';
import path from 'path';

const rootDir = import.meta.dirname;
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const license = fs.readFileSync('./LICENSE.md', 'utf8');

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

const browserBundleBase = {
  entry: { 'twilio-video': 'lib/index.ts' } as Record<string, string>,
  format: 'iife' as const,
  target: 'es2015',
  outDir: 'dist',
  platform: 'browser' as const,
  sourcemap: false,
  clean: false,
  dts: false,
  treeshake: true,
  banner: umdHeader,
  footer: umdFooter,
  alias: {
    ws: path.resolve(rootDir, 'src/ws.js'),
  },
  deps: {
    alwaysBundle: [/^events$/, /^util$/, /^ws$/],
  },
  outputOptions: {
    codeSplitting: false,
  },
};

export default defineConfig([
  // CJS unbundled (replaces tsc)
  {
    entry: ['lib/**/*.ts', 'lib/**/*.js'],
    format: 'cjs',
    target: 'es2015',
    outDir: 'es5',
    unbundle: true,
    root: 'lib',
    sourcemap: true,
    fixedExtension: false,
    clean: true,
    dts: false,
    treeshake: false,
    deps: {
      skipNodeModulesBundle: true,
      neverBundle: [/\.json$/],
    },
  },
  // Browser bundle (replaces browserify)
  {
    ...browserBundleBase,
    outputOptions: {
      ...browserBundleBase.outputOptions,
      entryFileNames: '[name].js',
    },
  },
  // Minified browser bundle (replaces uglify-js)
  {
    ...browserBundleBase,
    minify: true,
    outputOptions: {
      ...browserBundleBase.outputOptions,
      entryFileNames: '[name].min.js',
    },
  },
]);
