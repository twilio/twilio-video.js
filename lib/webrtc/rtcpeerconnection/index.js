/* globals mozRTCPeerConnection, RTCPeerConnection, webkitRTCPeerConnection */
'use strict';

if (typeof webkitRTCPeerConnection !== 'undefined') {
  module.exports = require('./chrome');
} else if (typeof mozRTCPeerConnection !== 'undefined') {
  module.exports = require('./firefox');
} else if (typeof RTCPeerConnection !== 'undefined') {
  module.exports = RTCPeerConnection;
}
