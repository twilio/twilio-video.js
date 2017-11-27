'use strict';

/**
 * Construct an {@link IdentityTrackMatcher}.
 * @class
 * @classdesc An {@link IdentityTrackMatcher} matches RTCTrackEvents
 *   with their respective MediaStreamTrack IDs.
 */
function IdentityTrackMatcher() {
  if (!(this instanceof IdentityTrackMatcher)) {
    return new IdentityTrackMatcher();
  }
  Object.defineProperties(this, {
    _sdp: {
      value: null,
      writable: true
    }
  });
}

/**
 * Match a given MediaStreamTrack with its ID.
 * @param {RTCTrackEvent} event
 * @returns {Track.ID}
 */
IdentityTrackMatcher.prototype.match = function match(event) {
  return event.track.id;
};

/**
 * Update the {@link IdentityTrackMatcher} with a new SDP.
 * @param {string} sdp
 */
IdentityTrackMatcher.prototype.update = function update(sdp) {
  this._sdp = sdp;
};

module.exports = IdentityTrackMatcher;
