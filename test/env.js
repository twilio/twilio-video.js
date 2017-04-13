'use strict';

// Pre-populate with test.json if it exists.
var env = {};
try {
  env = require('../test.json');
} catch (error) {
  // Do nothing.
}

// Copy environment variables
[
  ['ACCOUNT_SID',               'accountSid'],
  ['SIGNING_KEY_SID',           'signingKeySid'],
  ['SIGNING_KEY_SECRET',        'signingKeySecret'],
  ['CONFIGURATION_PROFILE_SID', 'configurationProfileSid'],
  ['ECS_SERVER',                'ecsServer'],
  ['WS_SERVER',                 'wsServer'],
  ['WS_SERVER_INSIGHTS',        'wsServerInsights'],
  ['LOG_LEVEL',                 'logLevel']
].forEach(function forEachKeyPair(keyPair) {
  var processEnvKey = keyPair[0];
  var envKey = keyPair[1];
  if (processEnvKey in process.env) {
    env[envKey] = process.env[processEnvKey];
  }
});

// Ensure required variables are present
[
  'accountSid',
  'signingKeySid',
  'signingKeySecret',
  'configurationProfileSid'
].forEach(function forEachRequiredKey(key) {
  if (!(key in env)) {
    throw new Error('Missing ' + key);
  }
});

module.exports = env;
