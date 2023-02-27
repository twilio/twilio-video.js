'use strict';

if (typeof RTCPeerConnection === 'function') {
  const { guessBrowser } = require('../util');
  switch (guessBrowser()) {
    case 'chrome':
      module.exports = require('./chrome');
      break;
    case 'firefox':
      module.exports = require('./firefox');
      break;
    case 'safari':
      module.exports = require('./safari');
      break;
    default:
      module.exports = RTCPeerConnection;
      break;
  }
} else {
  module.exports = function RTCPeerConnection() {
    throw new Error('RTCPeerConnection is not supported');
  };
}
