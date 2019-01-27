'use strict';

const guess = require('@twilio/webrtc/lib/util').guessBrowser();

module.exports = {
  isChrome: guess === 'chrome',
  isFirefox: guess === 'firefox',
  isSafari: guess === 'safari'
};
