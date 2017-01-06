#!/usr/bin/env node
'use strict';

const browserify = require('browserify');
const fs = require('fs');
const path = require('path');
const pkg = require('../package');
const source = require('vinyl-source-stream');
const stream = require('stream');
const vfs = require('vinyl-fs');

const entryPoint = pkg.main;
const template = process.argv[2];
const license = process.argv[3];
const dest = process.argv[4];

const bundler = browserify({
  entries: entryPoint
});

var entryPointId = null;
bundler.on('dep', dep => {
  entryPointId = dep.entry ? dep.id : entryPointId;
});

return Promise.all([
  readableStreamToPromise(fs.createReadStream(template)),
  readableStreamToPromise(fs.createReadStream(license)),
  readableStreamToPromise(bundler.bundle())
]).then(results => {
  if (entryPointId === null) {
    throw new Error('Entry point ID not found!');
  }

  const template = Buffer.concat(results[0]);
  const license = Buffer.concat(results[1]);
  const bundle = Buffer.concat(results[2]);
  const rendered = template.toString()
    .split('$name').join(pkg.name)
    .split('$version').join(pkg.version)
    .split('$license').join(license)
    .split('$entry').join(entryPointId)
    .split('$bundle').join(bundle.toString());

  const passThrough = new stream.PassThrough();
  passThrough.end(rendered);

  return readableStreamToPromise(passThrough
    .pipe(source(path.basename(dest)))
    .pipe(vfs.dest(path.dirname(dest))));
});

function readableStreamToPromise(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', chunk => chunks.push(chunk));
    readable.once('end', () => resolve(chunks));
    readable.once('error', reject);
  });
}
