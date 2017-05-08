/* global mozRTCIceCandidate, RTCIceCandidate */
'use strict';

if (typeof RTCIceCandidate !== 'undefined') {
  module.exports = RTCIceCandidate;
} else if (typeof mozRTCIceCandidate !== 'undefined') {
  module.exports = mozRTCIceCandidate;
} else {
  module.exports = function RTCIceCandidate() {
    throw new Error('WebRTC is unsupported');
  };
}
