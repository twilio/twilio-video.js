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

  var type = description ? null : 'rollback';
  var sdp = descriptionInitDict.sdp;

  Object.defineProperties(this, {
    _description: {
      get: function() {
        return description;
      }
    },
    // The .sdp property of an RTCSessionDescription can be updated. If we have
    // an underlying RTCSessionDescription, update that with a setter. (If not,
    // the user is able to set a property on the ChromeRTCSessionDescription
    // directly.)
    sdp: {
      enumerable: true,
      get: function() {
        return description ? description.sdp : sdp;
      },
      set: function(_sdp) {
        if (description) {
          description.sdp = _sdp;
          return;
        }
        sdp = _sdp;
      }
    },
    // The .type property of an RTCSessionDescription can be updated. If we have
    // an underlying RTCSessionDescription, update that with the setter. If not,
    // just update a type variable.
    type: {
      enumerable: true,
      get: function() {
        return description ? description.type : type;
      },
      set: function(_type) {
        if (_type === 'rollback' && description) {
          var sdp = description.sdp;
          description = null;
          this.sdp = sdp;
        } else if (description) {
          description.type = _type;
          return;
        } else if (['offer', 'answer', 'pranswer', 'rollback'].indexOf(_type) === -1) {
          // Chrome will reject setting .type to an invalid RTCSdpType. We
          // emulate that here, adding support for "rollback".
          return;
        }
        type = _type;
      }
    }
  });
}

module.exports = ChromeRTCSessionDescription;
