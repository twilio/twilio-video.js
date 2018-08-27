'use strict';

const { guessBrowser } = require('../../lib/util');

const env = require('../env');

const defaults = [
  'ecsServer',
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
}, {
  dominantSpeaker: true,
  networkQuality: true
});

// NOTE(mroberts): Firefox, since it doesn't support "max-bundle", really slows
// down with the number of ICE candidates it has to gather; therefore, in our
// tests, we disable ICE servers and trust our host candidates work out.
if (guessBrowser() === 'firefox') {
  defaults.iceServers = [];
}

module.exports = Object.seal(defaults);
