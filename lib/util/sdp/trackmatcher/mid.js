'use strict';

const getMediaSections = require('../').getMediaSections;

/**
 * An {@link MIDTrackMatcher} matches an RTCTrackEvent with a MediaStreamTrack
 * ID based on the MID of the underlying RTCRtpTransceiver.
 */
class MIDTrackMatcher {
  /**
   * Construct an {@link MIDTrackMatcher}.
   */
  constructor() {
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
  match(event) {
    return this._midsToTrackIds.get(event.transceiver.mid) || null;
  }

  /**
   * Update the {@link MIDTrackMatcher} with a new SDP.
   * @param {string} sdp
   */
  update(sdp) {
    const sections = getMediaSections(sdp, '(audio|video)');
    this._midsToTrackIds = sections.reduce((midsToTrackIds, section) => {
      const midMatches = section.match(/^a=mid:(.+)$/m) || [];
      const trackIdMatches = section.match(/^a=msid:.+ (.+)$/m) || [];
      const mid = midMatches[1];
      const trackId = trackIdMatches[1];
      return mid && trackId ? midsToTrackIds.set(mid, trackId) : midsToTrackIds;
    }, this._midsToTrackIds);
  }
}

module.exports = MIDTrackMatcher;
