/* global RTCIceCandidate */
'use strict';

if (typeof RTCIceCandidate === 'function') {
  module.exports = RTCIceCandidate;
} else {
  module.exports = function RTCIceCandidate() {
    throw new Error('RTCIceCandidate is not supported');
  };
}
