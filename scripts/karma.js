#!/usr/bin/env node
'use strict';

const { readdirSync, statSync } = require('fs');
const { Server, stopper } = require('karma');
const { parseConfig } = require('karma').config;
const { resolve: resolvePath } = require('path');
const { join } = require('path');

const configFile = join(__dirname, '..', process.argv[2]);
const integrationTests = join(__dirname, '..', 'test', 'integration', 'spec');
const dockerIntegrationTests = join(__dirname, '..', 'test', 'integration', 'spec', 'docker');
const isDocker = require('is-docker')();
const DockerProxyServer = require('../docker/dockerProxyServer');
function getTestPaths(path) {

  if (process.env.FILE) {
    return [resolvePath(process.env.FILE)];
  }

  var stat = statSync(path);
  if (stat && stat.isDirectory()) {
    return readdirSync(path).reduce((files, file) => {
      return files.concat(getTestPaths(`${path}/${file}`));
    }, []);
  }

  return [path];
}


// NOTE(mroberts): We have a memory leak, either in twilio-video.js or in
// Firefox, that causes Firefox to slow down after running a bunch of tests that
// exercise WebRTC APIs. To workaround this, we spawn Karma for each integration
// test module.
async function main() {
  let dockerProxy = null;
  if (isDocker) {
    try {
      console.log('running tests inside docker!');
      dockerProxy = new DockerProxyServer();
      await dockerProxy.startServer();
    } catch (err) {
      console.log('Error excuting dockerProxy:', err);
      dockerProxy = null;
    }
  }

  const files = getTestPaths(dockerProxy ? dockerIntegrationTests : integrationTests);

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

  if (dockerProxy) {
    dockerProxy.stopServer();
  }
  process.exit(processExitCode);
}

main();
