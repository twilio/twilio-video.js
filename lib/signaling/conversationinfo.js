'use strict';

/**
 * JSON conformant to version 1 of the application/conversation-info+json
 * content-type.
 * @typedef ConversationInfo
 * @type {object}
 */

var PROTOCOL_VERSION = "v1";

/**
 * Generate {@link ConversationInfo} for a {@link Track} change.
 * @private
 * @param {string} kind - the {@link Track}'s kind ("audio" or "video")
 * @param {string} event - the event name
 *   the {@link Track}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 * @param {string} id - media stream id the {@link Track}
 * @returns ConversationInfo
 */
function track(kind, event, participantSid, id) {
  return {
    "protocol_version": PROTOCOL_VERSION,
    "event_list": [
      {
        "event": event,
        "time_stamp": (new Date()).toUTCString(),
        "participant_sid": participantSid,
        "tracks": [
          {
            "kind": kind,
            "msid": id
          }
        ]
      }
    ]
  };
}

/**
 * Generate {@link ConversationInfo} for muting an {@link AudioTrack}.
 * @param {string} address - the address of the {@link Participant} who owns
 *   the {@link AudioTrack}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 *   the {@link AudioTrack}
 * @returns ConversationInfo
 */
var trackMuted = track.bind(null, 'audio', 'track_muted');

/**
 * Generate {@link ConversationInfo} for unmuting an {@link AudioTrack}.
 * @param {string} address - the address of the {@link Participant} who owns
 *   the {@link AudioTrack}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 *   the {@link AudioTrack}
 * @returns ConversationInfo
 */
var trackUnmuted = track.bind(null, 'audio', 'track_unmuted');

/**
 * Generate {@link ConversationInfo} for pausing a {@link VideoTrack}.
 * @param {string} address - the address of the {@link Participant} who owns
 *   the {@link VideoTrack}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 *   the {@link VideoTrack}
 * @returns ConversationInfo
 */
var trackPaused = track.bind(null, 'video', 'track_paused');

/**
 * Generate {@link ConversationInfo} for unpausing a {@link VideoTrack}.
 * @param {string} address - the address of the {@link Participant} who owns
 *   the {@link VideoTrack}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 *   the {@link VideoTrack}
 * @returns ConversationInfo
 */
var trackUnpaused = track.bind(null, 'video', 'track_unpaused');

module.exports.trackMuted = trackMuted;
module.exports.trackUnmuted = trackUnmuted;
module.exports.trackPaused = trackPaused;
module.exports.trackUnpaused = trackUnpaused;
