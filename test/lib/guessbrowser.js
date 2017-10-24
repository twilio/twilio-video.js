'use strict';

const guess = require('../../lib/util').guessBrowser();

module.exports = {
  isChrome: guess === 'chrome',
  isFirefox: guess === 'firefox',
  isSafari: guess === 'safari'
};
