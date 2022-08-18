'use strict';

// NOTE(mroberts): We need to do this for envify.
/* eslint no-process-env:0 */
const processEnv = {
  ACCOUNT_SID: process.env.ACCOUNT_SID,
  API_KEY_SID: process.env.API_KEY_SID,
  API_KEY_SECRET: process.env.API_KEY_SECRET,
  ECS_SERVER: process.env.ECS_SERVER,
  ENVIRONMENT: process.env.ENVIRONMENT,
  WS_SERVER: process.env.WS_SERVER,
  WS_SERVER_INSIGHTS: process.env.WS_SERVER_INSIGHTS,
  LOG_LEVEL: process.env.LOG_LEVEL,
  ENABLE_REST_API_TESTS: process.env.ENABLE_REST_API_TESTS,
  TEST_STABILITY: process.env.TEST_STABILITY,
  REGIONS: process.env.REGIONS,
  TOPOLOGY: process.env.TOPOLOGY,
  LARGE_ROOM: process.env.LARGE_ROOM
};

// Copy environment variables
const env = [
  ['ACCOUNT_SID',               'accountSid'],
  ['API_KEY_SID',               'apiKeySid'],
  ['API_KEY_SECRET',            'apiKeySecret'],
  ['ECS_SERVER',                'ecsServer'],
  ['ENVIRONMENT',               'environment'],
  ['WS_SERVER',                 'wsServer'],
  ['WS_SERVER_INSIGHTS',        'wsServerInsights'],
  ['ENABLE_REST_API_TESTS',     'enableRestApiTests'],
  ['TEST_STABILITY',            'testStability'],
  ['REGIONS',                   'regions'],
  ['TOPOLOGY',                  'topology'],
  ['LARGE_ROOM',                'largeRoom']
].reduce((env, [processEnvKey, envKey]) => {
  if (processEnvKey in processEnv) {
    env[envKey] = processEnv[processEnvKey];
  }
  return env;
}, {});

// Ensure required variables are present
[
  'accountSid',
  'apiKeySid',
  'apiKeySecret'
].forEach(function forEachRequiredKey(key) {
  if (!(key in env)) {
    throw new Error('Missing ' + key);
  }
});

module.exports = env;
