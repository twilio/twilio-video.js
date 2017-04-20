#!/usr/bin/env node
'use strict';

const spawnSync = require('child_process').spawnSync;

// NOTE(mroberts): Skip integration tests on Travis if we are not using secure
// environment variables (i.e., this is a third-party pull request).
if (process.env.TRAVIS_SECURE_ENV_VARS === 'false') {
  console.log('Skipping integration tests...');
  process.exit(0);
}

const childProcess = spawnSync('npm', ['run', 'test:integration:node'], {
  stdio: 'inherit'
});

if (childProcess.error) {
  throw childProcess.error;
}

process.exit(childProcess.status);
