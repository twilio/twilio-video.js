/* globals RTCSessionDescription */
'use strict';

// This class wraps Chrome's RTCSessionDescription implementation. It provides
// one piece of functionality not currently present in Chrome, namely
//
//   1. Rollback support
//      https://bugs.chromium.org/p/webrtc/issues/detail?id=4676
//
function ChromeRTCSessionDescription(descriptionInitDict) {
  if (!(this instanceof ChromeRTCSessionDescription)) {
    return new ChromeRTCSessionDescription(descriptionInitDict);
  }

  // If this constructor is called with an object with a .type property set to
  // "rollback", we should not call Chrome's RTCSessionDescription constructor,
  // because this would throw an RTCSdpType error.
  var description = descriptionInitDict && descriptionInitDict.type === 'rollback'
    ? null
    : new RTCSessionDescription(descriptionInitDict);

  Object.defineProperties(this, {
    _description: {
      get: function() {
        return description;
      }
    },
    sdp: {
      enumerable: true,
      value: description ? description.sdp : descriptionInitDict.sdp
    },
    type: {
      enumerable: true,
      value: description ? description.type : descriptionInitDict.type
    }
  });
}

module.exports = ChromeRTCSessionDescription;
