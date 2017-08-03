'use strict';

var guessBrowser = require('../../util').guessBrowser;

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
    if (typeof RTCPeerConnection === 'undefined') {
      break;
    }
    module.exports = RTCPeerConnection;
}
