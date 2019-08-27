#!/usr/bin/env node
'use strict';

const { readdirSync, statSync } = require('fs');
const { Server, stopper } = require('karma');
const { parseConfig } = require('karma').config;
const { join } = require('path');

const configFile = join(__dirname, '..', process.argv[2]);
const integrationTests = join(__dirname, '..', 'test', 'integration', 'spec');
const isDocker = require('is-docker')();
const DockerProxyServer = require('../docker/dockerProxyServer');


function getTestPaths(path) {
  // // TODO: remove this hack
  // const dockerTestFile1 = require('path').resolve('./test/integration/spec/docker.js');
  // const dockerTestFile2 = require('path').resolve('./test/integration/spec/handoff.js');
  // return [dockerTestFile1, dockerTestFile2];
  if (process.env.FILE) {
    return [process.env.FILE];
  }
  var stat = statSync(path);
  if (stat && stat.isDirectory()) {
    return readdirSync(path).reduce((files, file) => {
      return files.concat(getTestPaths(`${path}/${file}`));
    }, []);
  }

  return [path];
}

const files = getTestPaths(integrationTests);

// NOTE(mroberts): We have a memory leak, either in twiliovideo.js or in
// Firefox, that causes Firefox to slow down after running a bunch of tests that
// exercise WebRTC APIs. To workaround this, we spawn Karma for each integration
// test module.
async function main(files) {
  let dockerProxy = null;
  if (isDocker) {
    console.log('running tests inside docker!');
    dockerProxy = new DockerProxyServer();
    dockerProxy.startServer();
  }

  for (const file of files) {
    const config = parseConfig(configFile, { files: [file] });

    // eslint-disable-next-line no-await-in-loop
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

  if (dockerProxy) {
    dockerProxy.stopServer();
  }
}

main(files);
