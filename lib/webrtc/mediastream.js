/* globals webkitMediaStream, MediaStream */
'use strict';

if (typeof webkitMediaStream !== 'undefined') {
  module.exports = webkitMediaStream;
} else if (typeof MediaStream !== 'undefined') {
  module.exports = MediaStream;
} else {
  module.exports = function MediaStream() {
    throw new Error('WebRTC is not supported in this browser');
  };
}
