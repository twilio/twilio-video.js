'use strict';

var getMediaSections = require('../').getMediaSections;

/**
 * Construct an {@link MIDTrackMatcher}.
 * @class
 * @classdesc An {@link MIDTrackMatcher} matches an RTCTrackEvent with a
 *   MediaStreamTrack ID based on the MID of the underlying RTCRtpTransceiver.
 */
function MIDTrackMatcher() {
  if (!(this instanceof MIDTrackMatcher)) {
    return new MIDTrackMatcher();
  }
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
MIDTrackMatcher.prototype.match = function match(event) {
  return this._midsToTrackIds.get(event.transceiver.mid) || null;
};

/**
 * Update the {@link MIDTrackMatcher} with a new SDP.
 * @param {string} sdp
 */
MIDTrackMatcher.prototype.update = function update(sdp) {
  var sections = getMediaSections(sdp, '(audio|video)');
  this._midsToTrackIds = sections.reduce(function(midsToTrackIds, section) {
    var midMatches = section.match(/^a=mid:(.+)$/m) || [];
    var trackIdMatches = section.match(/^a=msid:.+ (.+)$/m) || [];
    var mid = midMatches[1];
    var trackId = trackIdMatches[1];
    return mid && trackId ? midsToTrackIds.set(mid, trackId) : midsToTrackIds;
  }, this._midsToTrackIds);
};

module.exports = MIDTrackMatcher;
