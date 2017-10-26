'use strict';

// NOTE(mroberts): We need to do this for envify.
/* eslint no-process-env:0 */
const processEnv = {
  ACCOUNT_SID: process.env.ACCOUNT_SID,
  API_KEY_SID: process.env.API_KEY_SID,
  API_KEY_SECRET: process.env.API_KEY_SECRET,
  CONFIGURATION_PROFILE_SID: process.env.CONFIGURATION_PROFILE_SID,
  ECS_SERVER: process.env.ECS_SERVER,
  WS_SERVER: process.env.WS_SERVER,
  WS_SERVER_INSIGHTS: process.env.WS_SERVER_INSIGHTS,
  LOG_LEVEL: process.env.LOG_LEVEL
};

// Copy environment variables
const env = [
  ['ACCOUNT_SID',               'accountSid'],
  ['API_KEY_SID',               'apiKeySid'],
  ['API_KEY_SECRET',            'apiKeySecret'],
  ['CONFIGURATION_PROFILE_SID', 'configurationProfileSid'],
  ['ECS_SERVER',                'ecsServer'],
  ['WS_SERVER',                 'wsServer'],
  ['WS_SERVER_INSIGHTS',        'wsServerInsights'],
  ['LOG_LEVEL',                 'logLevel']
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
  'apiKeySecret',
  'configurationProfileSid'
].forEach(function forEachRequiredKey(key) {
  if (!(key in env)) {
    throw new Error('Missing ' + key);
  }
});

module.exports = env;
