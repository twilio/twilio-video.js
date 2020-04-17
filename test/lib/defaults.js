'use strict';

const env = require('../env');

const defaults = [
  'ecsServer',
  'environment',
  'logLevel',
  'regions',
  'topology',
  'wsServer',
  'wsServerInsights',
  'testStability'
].reduce((defaults, option) => {
  if (typeof env[option] !== 'undefined') {
    Object.defineProperty(defaults, option, {
      enumerable: true,
      value: env[option]
    });
  }
  return defaults;
}, {
  dominantSpeaker: true,
  environment: 'prod',
  insights: env.environment !== 'stage', // disable insights for stage. (JSDK-2761)
  networkQuality: true,
  topology: 'peer-to-peer',
  testStability: 'all' // other choices: 'stable', 'unstable'
});

module.exports = Object.seal(defaults);
