#!/usr/bin/env node
'use strict';

const { readdirSync, statSync } = require('fs');
const { Server, stopper } = require('karma');
const { parseConfig } = require('karma').config;
const { resolve: resolvePath } = require('path');
const { join } = require('path');

const configFile = join(__dirname, '..', process.argv[2]);
const integrationTests = join(__dirname, '..', 'test', 'integration', 'spec');
function getTestPaths(path) {
  var stat = statSync(path);
  if (stat && stat.isDirectory()) {
    return readdirSync(path).reduce((files, file) => {
      return files.concat(getTestPaths(`${path}/${file}`));
    }, []);
  }

  return [path];
}

function filterTests(paths) {
  if (process.env.TEST_FILES) {
    let testFiles = process.env.TEST_FILES.split('\n');
    testFiles = testFiles.map(file => resolvePath(file));
    return paths.filter(path => testFiles.includes(path));
  }
  return paths;
}

// NOTE(mroberts): We have a memory leak, either in twilio-video.js or in
// Firefox, that causes Firefox to slow down after running a bunch of tests that
// exercise WebRTC APIs. To workaround this, we spawn Karma for each integration
// test module.
async function main() {

  const files = filterTests(getTestPaths(integrationTests));

  let processExitCode = 0;
  for (const file of files) {
    const config = parseConfig(configFile, { files: [file] });

    // eslint-disable-next-line no-await-in-loop
    const exitCode = await new Promise(resolve => {
      const server = new Server(config, resolve);
      server.start();
      process.once('exit', () => stopper.stop({}));
      process.once('SIGINT', () => process.exit());
    });

    if (exitCode && !processExitCode) {
      // Note(mpatwardhan) if tests fail for one file,
      // note the exitcode but continue running for rest
      // of the files.
      processExitCode = exitCode;
      console.log('Failed for file:', file);
    }
  }

  process.exit(processExitCode);
}

main();
