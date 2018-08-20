'use strict';

const env = require('../env');

const defaults = Object.seal([
  'ecsServer',
  'environment',
  'logLevel',
  'wsServer',
  'wsServerInsights'
].reduce((defaults, option) => {
  if (typeof env[option] !== 'undefined') {
    Object.defineProperty(defaults, option, {
      enumerable: true,
      value: env[option]
    });
  }
  return defaults;
}, { _useTwilioConnection: !!env.useTwilioConnection }));

module.exports = defaults;
