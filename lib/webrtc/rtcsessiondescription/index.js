/* globals mozRTCSessionDescription, RTCSessionDescription, webkitRTCPeerConnection */
'use strict';

if (typeof webkitRTCPeerConnection !== 'undefined') {
  module.exports = require('./chrome');
} else if (typeof mozRTCSessionDescription !== 'undefined') {
  module.exports = require('./firefox');
} else if (typeof RTCSessionDescription !== 'undefined') {
  module.exports = RTCSessionDescription;
}
