'use strict';

/**
 * An {@link IdentityTrackMatcher} matches RTCTrackEvents with their respective
 * MediaStreamTrack IDs.
 */
class IdentityTrackMatcher {
  /**
  * Match a given MediaStreamTrack with its ID.
  * @param {RTCTrackEvent} event
  * @returns {Track.ID}
  */
  match(event) {
    return event.track.id;
  }

  /**
  * Update the {@link IdentityTrackMatcher} with a new SDP.
  * @param {string} sdp
  */
  update() {}
}

module.exports = IdentityTrackMatcher;
