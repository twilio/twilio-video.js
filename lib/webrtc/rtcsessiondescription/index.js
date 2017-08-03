'use strict';

var guessBrowser = require('../../util').guessBrowser;

switch (guessBrowser()) {
  case 'chrome':
    module.exports = require('./chrome');
    break;
  case 'firefox':
    module.exports = require('./firefox');
    break;
  default:
    if (typeof RTCSessionDescription === 'undefined') {
      break;
    }
    module.exports = RTCSessionDescription;
}
