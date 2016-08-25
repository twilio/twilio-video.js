/* global mozRTCIceCandidate, RTCIceCandidate */
'use strict';

if (typeof mozRTCIceCandidate !== 'undefined') {
  module.exports = mozRTCIceCandidate;
} else if (typeof RTCIceCandidate !== 'undefined') {
  module.exports = RTCIceCandidate;
}
