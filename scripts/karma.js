#!/usr/bin/env node
'use strict';

const { readdirSync, statSync } = require('fs');
const { Server, stopper } = require('karma');
const { parseConfig } = require('karma').config;
const { join } = require('path');

const configFile = join(__dirname, '..', 'integration.conf.js');
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

const files = getTestPaths(integrationTests).filter(path => !/webrtc/.test(path));

// NOTE(mroberts): We have a memory leak, either in twilio-video.js or in
// Firefox, that causes Firefox to slow down after running a bunch of tests that
// exercise WebRTC APIs. To workaround this, we spawn Karma for each integration
// test module.
async function main(files) {
  for (const file of files) {
    const config = parseConfig(configFile, { files: [file] });

    const exitCode = await new Promise(resolve => {
      const server = new Server(config, resolve);
      server.start();
      process.once('exit', () => stopper.stop({}));
      process.once('SIGINT', () => process.exit());
    });

    if (exitCode) {
      process.exit(exitCode);
    }
  }
}

main(files);
