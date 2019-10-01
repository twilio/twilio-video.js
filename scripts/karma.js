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

function filterTests(paths) {
  // NOTE: to enable running tests in parallel (in CI)
  //  you can split test files into groups by setting
  //  TEST_RUN=a/b, where
  //    b  = number of groups to split test files into
  //    a  = current group to run.
  //  For example: by specifying TEST_RUN=1/5 will
  //  cause the test files to be split in 5 groups,
  //  with 1st group running in this instance.
  let currentRun = 1;
  let totalRuns = 1;
  if (process.env.TEST_RUN) {
    const [a, b] = process.env.TEST_RUN.split('/');
    currentRun = parseInt(a);
    totalRuns = parseInt(b);
    if (isNaN(currentRun) || isNaN(totalRuns) || currentRun < 1 || totalRuns < currentRun) {
      console.log(`Ignoring invalid TEST_RUN: ${currentRun}/${totalRuns}`);
      currentRun = 1;
      totalRuns = 1;
    }

    if (paths.length < totalRuns) {
      console.warn(`You are splitting ${paths.length} files into ${totalRuns} groups!`);
    }
  }

  return paths.filter((_, index) => index % totalRuns === currentRun - 1);
}

// NOTE(mroberts): We have a memory leak, either in twilio-video.js or in
// Firefox, that causes Firefox to slow down after running a bunch of tests that
// exercise WebRTC APIs. To workaround this, we spawn Karma for each integration
// test module.
async function main() {
  let dockerProxy = null;
  if (isDocker) {
    console.log('running tests inside docker!');
    try {
      dockerProxy = new DockerProxyServer();
      await dockerProxy.startServer();
      console.log('DockerProxyServer started successfully. Network tests may run as part of this run!');
    } catch (err) {
      // NOTE(mpatwardhan): This can happen in CI environment, when we run integration tests inside docker
      // container without mapping docker socket inside the container.
      console.log('DockerProxyServer failed to start.  Network tests will not run as part of this run!');
      dockerProxy = null;
    }
  }

  const files = filterTests(getTestPaths(dockerProxy ? dockerIntegrationTests : integrationTests));

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
