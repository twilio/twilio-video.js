'use strict';
var getMediaSections = require('./').getMediaSections;
/**
 * An {@link TrackMatcher} matches an RTCTrackEvent with a MediaStreamTrack
 * ID based on the MID of the underlying RTCRtpTransceiver.
 */
var TrackMatcher = /** @class */ (function () {
    /**
     * Construct an {@link TrackMatcher}.
     */
    function TrackMatcher() {
        Object.defineProperties(this, {
            _midsToTrackIds: {
                value: new Map(),
                writable: true
            }
        });
    }
    /**
     * Match a given MediaStreamTrack with its ID.
     * @param {RTCTrackEvent} event
     * @returns {?Track.ID}
     */
    TrackMatcher.prototype.match = function (event) {
        return this._midsToTrackIds.get(event.transceiver.mid) || null;
    };
    /**
     * Update the {@link TrackMatcher} with a new SDP.
     * @param {string} sdp
     */
    TrackMatcher.prototype.update = function (sdp) {
        var sections = getMediaSections(sdp, '(audio|video)');
        this._midsToTrackIds = sections.reduce(function (midsToTrackIds, section) {
            var midMatches = section.match(/^a=mid:(.+)$/m) || [];
            var trackIdMatches = section.match(/^a=msid:.+ (.+)$/m) || [];
            var mid = midMatches[1];
            var trackId = trackIdMatches[1];
            return mid && trackId ? midsToTrackIds.set(mid, trackId) : midsToTrackIds;
        }, this._midsToTrackIds);
    };
    return TrackMatcher;
}());
module.exports = TrackMatcher;
//# sourceMappingURL=trackmatcher.js.map