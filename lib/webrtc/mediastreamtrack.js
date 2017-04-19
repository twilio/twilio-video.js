/* global MediaStreamTrack */
'use strict';

if (typeof MediaStreamTrack !== 'undefined') {
  module.exports = MediaStreamTrack;
} else {
  module.exports = function MediaStreamTrack() {
    throw new Error('WebRTC is not supported in this browser');
  };
}
