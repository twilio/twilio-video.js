'use strict';

// NOTE(mroberts): We need to do this for envify.
/* eslint no-process-env:0 */
const processEnv = {
  ECS_SERVER: process.env.ECS_SERVER,
  ENVIRONMENT: process.env.ENVIRONMENT,
  WS_SERVER: process.env.WS_SERVER,
  WS_SERVER_INSIGHTS: process.env.WS_SERVER_INSIGHTS,
  LOG_LEVEL: process.env.LOG_LEVEL,
  ENABLE_REST_API_TESTS: process.env.ENABLE_REST_API_TESTS,
  TEST_STABILITY: process.env.TEST_STABILITY,
  REGIONS: process.env.REGIONS,
  TOPOLOGY: process.env.TOPOLOGY
};

// Copy environment variables
const env = [
  ['ECS_SERVER',                'ecsServer'],
  ['ENVIRONMENT',               'environment'],
  ['WS_SERVER',                 'wsServer'],
  ['WS_SERVER_INSIGHTS',        'wsServerInsights'],
  ['LOG_LEVEL',                 'logLevel'],
  ['ENABLE_REST_API_TESTS',     'enableRestApiTests'],
  ['TEST_STABILITY',            'testStability'],
  ['REGIONS',                   'regions'],
  ['TOPOLOGY',                  'topology']
].reduce((env, [processEnvKey, envKey]) => {
  if (processEnvKey in processEnv) {
    env[envKey] = processEnv[processEnvKey];
  }
  return env;
}, {});

module.exports = env;
