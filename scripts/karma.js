#!/usr/bin/env node
'use strict';

const { readdirSync, statSync } = require('fs');
const { Server, config: { parseConfig }, stopper } = require('karma');
const { resolve: resolvePath } = require('path');
const { join } = require('path');

const staticServer = require('node-http-server');

const configFile = join(__dirname, '..', process.argv[2]);
const integrationTests = join(__dirname, '..', 'test', 'integration', 'spec');
const dockerIntegrationTests = join(__dirname, '..', 'test', 'integration', 'spec', 'docker');
const isDocker = require('is-docker')();
const DockerProxyServer = require('../docker/dockerProxyServer');

function getTestPaths(path) {
  const stat = statSync(path);
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

  // NOTE(mmalavalli): Deploy the file server. This is used to serve static assets
  // like images, music files, etc. which are used by some integration tests.
  await new Promise(resolve => staticServer.deploy({
    contentType: { m4a: 'audio/mp4' },
    port: 9877,
    root: `${process.cwd()}/test/`
  }, resolve));

  let processExitCode = 0;
  for (const file of files) {
    const config = parseConfig(configFile, { files: [file] });

    // eslint-disable-next-line no-await-in-loop
    const exitCode = await new Promise(resolve => {
      const server = new Server(config, resolve);
      server.start();
      process.once('exit', () => stopper.stop(config));
      process.once('SIGINT', () => process.exit());
    });

    if (exitCode && !processExitCode) {
      // NOTE(mpatwardhan) if tests fail for one file,
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
