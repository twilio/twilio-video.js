/* globals RTCSessionDescription */
'use strict';
// This class wraps Chrome's RTCSessionDescription implementation. It provides
// one piece of functionality not currently present in Chrome, namely
//
//   1. Rollback support
//      https://bugs.chromium.org/p/webrtc/issues/detail?id=4676
//
var ChromeRTCSessionDescription = /** @class */ (function () {
    function ChromeRTCSessionDescription(descriptionInitDict) {
        this.descriptionInitDict = descriptionInitDict;
        // If this constructor is called with an object with a .type property set to
        // "rollback", we should not call Chrome's RTCSessionDescription constructor,
        // because this would throw an RTCSdpType error.
        var description = descriptionInitDict && descriptionInitDict.type === 'rollback'
            ? null
            : new RTCSessionDescription(descriptionInitDict);
        Object.defineProperties(this, {
            _description: {
                get: function () {
                    return description;
                }
            }
        });
    }
    Object.defineProperty(ChromeRTCSessionDescription.prototype, "sdp", {
        get: function () {
            return this._description ? this._description.sdp : this.descriptionInitDict.sdp;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChromeRTCSessionDescription.prototype, "type", {
        get: function () {
            return this._description ? this._description.type : this.descriptionInitDict.type;
        },
        enumerable: false,
        configurable: true
    });
    return ChromeRTCSessionDescription;
}());
module.exports = ChromeRTCSessionDescription;
//# sourceMappingURL=chrome.js.map