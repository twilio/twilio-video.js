#!/usr/bin/env node
'use strict';

const getOptions = require('../test/framework/options');
const spawnSync = require('child_process').spawnSync;

const filepath = `../test/framework/${process.argv[2]}.json`;
const options = getOptions(require(filepath));

const childProcess = spawnSync(options.test.command, options.test.args, {
  cwd: options.path,
  env: Object.assign({}, options.test.env, process.env),
  stdio: 'inherit'
});

if (childProcess.error) {
  throw childProcess.error;
}
