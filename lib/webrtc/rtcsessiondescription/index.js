/* globals RTCSessionDescription */
'use strict';

if (typeof RTCSessionDescription === 'function') {
  const { guessBrowser } = require('../util');
  switch (guessBrowser()) {
    case 'chrome':
      module.exports = require('./chrome');
      break;
    case 'firefox':
      module.exports = require('./firefox');
      break;
    default:
      module.exports = RTCSessionDescription;
      break;
  }
} else {
  module.exports = function RTCSessionDescription() {
    throw new Error('RTCSessionDescription is not supported');
  };
}
