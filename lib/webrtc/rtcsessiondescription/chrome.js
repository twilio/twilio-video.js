/* globals RTCSessionDescription */
'use strict';

// This class wraps Chrome's RTCSessionDescription implementation. It provides
// one piece of functionality not currently present in Chrome, namely
//
//   1. Rollback support
//      https://bugs.chromium.org/p/webrtc/issues/detail?id=4676
//
class ChromeRTCSessionDescription {
  constructor(descriptionInitDict) {
    this.descriptionInitDict = descriptionInitDict;

    // If this constructor is called with an object with a .type property set to
    // "rollback", we should not call Chrome's RTCSessionDescription constructor,
    // because this would throw an RTCSdpType error.
    const description = descriptionInitDict && descriptionInitDict.type === 'rollback'
      ? null
      : new RTCSessionDescription(descriptionInitDict);

    Object.defineProperties(this, {
      _description: {
        get: function() {
          return description;
        }
      }
    });
  }

  get sdp() {
    return this._description ? this._description.sdp : this.descriptionInitDict.sdp;
  }

  get type() {
    return this._description ? this._description.type : this.descriptionInitDict.type;
  }
}

module.exports = ChromeRTCSessionDescription;
