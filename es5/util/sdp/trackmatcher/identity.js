'use strict';
/**
 * An {@link IdentityTrackMatcher} matches RTCTrackEvents with their respective
 * MediaStreamTrack IDs.
 */
var IdentityTrackMatcher = /** @class */ (function () {
    function IdentityTrackMatcher() {
    }
    /**
    * Match a given MediaStreamTrack with its ID.
    * @param {RTCTrackEvent} event
    * @returns {Track.ID}
    */
    IdentityTrackMatcher.prototype.match = function (event) {
        return event.track.id;
    };
    /**
    * Update the {@link IdentityTrackMatcher} with a new SDP.
    * @param {string} sdp
    */
    IdentityTrackMatcher.prototype.update = function () { };
    return IdentityTrackMatcher;
}());
module.exports = IdentityTrackMatcher;
//# sourceMappingURL=identity.js.map