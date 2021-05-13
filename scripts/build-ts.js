#!/usr/bin/env node
'use strict';

const glob = require('glob');
const { ncp } = require('ncp');
const { exec } = require('child_process');

const tsconfig = process.argv[2];
const tsBuildFolder = process.argv[3];
const tsdefFolder = process.argv[4];
const es5Folder = process.argv[5];

const runCommand = command => new Promise(done => {
  console.log(`node exec: ${command}`);
  const proc = exec(command);
  proc.stdout.on('data', data => console.log(data.toString()));
  proc.stderr.on('data', data => console.error(data.toString()));
  proc.on('exit', done);
});

const sync = (src, dest) => new Promise(resolve => {
  ncp(src, dest, err => {
    if (err) {
      console.error(`Error detected while syncing ${src} with ${dest}`);
      console.error(err);
    }
    resolve();
  });
});

const build = async () => {
  // Build ts
  await runCommand(`rm -rf ${tsBuildFolder} && ./node_modules/.bin/tsc -p ${tsconfig}`);

  // Copy built files
  await sync(`${tsBuildFolder}/`, `${es5Folder}/`, 'js');
  await sync(`${tsBuildFolder}/`, `${tsdefFolder}/`, 'ts');

  // Remove unnecessary files
  [{ dir: es5Folder, toDelete: '.ts' }, { dir: tsdefFolder, toDelete: '.js' }]
  .forEach(({ dir, toDelete }) => glob.sync(`${dir}/**/*`)
    .filter(file => file.substring(file.lastIndexOf('.')) === toDelete)
    .forEach(file => runCommand(`rm ${file}`))
  );
};

build();
