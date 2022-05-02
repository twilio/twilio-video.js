'use strict';

const env = require('../env');

const defaults = [
  'ecsServer',
  'environment',
  'largeRoom',
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
  largeRoom: false,
  networkQuality: true,
  topology: 'peer-to-peer',
  testStability: 'all' // other choices: 'stable', 'unstable'
});

// TODO(mmalavalli) Remove this once large rooms is available in stage/prod.
if (defaults.largeRoom) {
  defaults.region = 'us2';
}

module.exports = Object.seal(defaults);
