'use strict';

/**
 * JSON conformant to version 1 of the application/conversation-info+json
 * content-type.
 * @typedef ConversationInfo
 * @type {object}
 */

var PROTOCOL_VERSION = 'v1';

/**
 * Generate {@link ConversationInfo} for a {@link Track} change.
 * @private
 * @param {string} event - the event name
 *   the {@link Track}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 * @param {Track} track - the {@link Track}
 * @returns ConversationInfo
 */
function track(event, participantSid, _track) {
  /* eslint camelcase:0 */
  return {
    protocol_version: PROTOCOL_VERSION,
    type: 'partial',
    event_list: [
      {
        event: event,
        time_stamp: (new Date()).toUTCString(),
        participant_sid: participantSid,
        tracks: [
          {
            kind: _track.kind,
            id: _track.id
          }
        ]
      }
    ]
  };
}

/**
 * Generate {@link ConversationInfo} for disabling a {@link Track}.
 * @param {string} address - the address of the {@link Participant} who owns
 *   the {@link Track}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 *   the {@link Track}
 * @returns ConversationInfo
 */
var trackDisabled = track.bind(null, 'track_disabled');

/**
 * Generate {@link ConversationInfo} for enabling a {@link Track}.
 * @param {string} address - the address of the {@link Participant} who owns
 *   the {@link Track}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 *   the {@link Track}
 * @returns ConversationInfo
 */
var trackEnabled = track.bind(null, 'track_enabled');

module.exports.trackDisabled = trackDisabled;
module.exports.trackEnabled = trackEnabled;
