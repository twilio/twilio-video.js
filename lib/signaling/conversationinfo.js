'use strict';

var util = require('../util');

/**
 * JSON conformant to version 1 of the application/conversation-info+json
 * content-type.
 * @typedef ConversationInfo
 * @type {object}
 */

var PROTOCOL_VERSION = "v1";

/**
 * JSON conformant to version 1 of the application/conversation-info+json
 * content-type.
 * @typedef Notification
 * @type {object}
 * @property {string} protocol_version
 * @property {Array<ConversationEvent>} event_list
 */

/**
 * A partial {@link Notification} received from the server
 * @typedef PartialNotification
 * @type {Notification}
 */

/**
 * A full {@link Notification} received from the server
 * @typedef FullNotification
 * @type {PartialNotification}
 * @property {ConversationState} conversation_state
 */

/**
 * @typedef ConversationState
 * @type {Object}
 * @property {number} instance_version
 * @property {string} sid - a {@link Conversation} SID
 * @property {Array<ParticipantInfo>} participants
 */

/**
 * @typedef ParticipantInfo
 * @type {Object}
 * @property {string} sid - a {@link Participant} SID
 * @property {string} address - a {@link Participant} address
 * @property {Array<TrackInfo>} tracks
 */

/**
 * @typedef TrackInfo
 * @type {Object}
 * @property {?string} id - a {@link Track} ID
 * @property {string} kind - one of "audio" or "video"
 */

/**
 * @typedef ConversationEvent
 * @type {ParticipantInfo}
 * @property {string} event - one of "participantConnected" or
 *   "participantDisconnected"
 * @property {number} instance_version
 */

/**
 * Check whether a {@link Notification} is a {@link PartialNotification}.
 * @param {string|Object} notification
 * @returns {boolean}
 */
function isPartialNotification(notification) {
  return !isFullNotification(notification);
}

/**
 * Check whether a {@link Notification} is a {@link FullNotification}.
 * @param {string|Object} notification
 * @returns {boolean}
 */
function isFullNotification(notification) {
  notification = validateOr(parseStringOrJSON.bind(null, notification), false);
  return notification && 'conversation_state' in notification;
}

/**
 * Parse a {@link FullNotification} or a {@link PartialNotification}.
 * @param {string|Object} notification
 * @returns {FullNotification|PartialNotification}
 * @throws {Error}
 */
function parseNotification(stringOrJSON) {
  var notification = parseStringOrJSON(stringOrJSON);
  return isFullNotification(notification)
    ? parseFullNotification(notification)
    : parsePartialNotification(notification);
}

/**
 * Parse a {@link PartialNotification}.
 * @param {string|Object} notification
 * @returns {PartialNotification}
 * @throws {Error}
 */
function parsePartialNotification(stringOrJSON) {
  return validatePartialNotification(parseStringOrJSON(stringOrJSON));
}

/**
 * Validate a {@link PartialNotification}.
 * @param {*} partialNotification
 * @returns {PartialNotification}
 * @throws {Error}
 */
function validatePartialNotification(partialNotification) {
  validateObject('Partial Notification', partialNotification);
  return {
    protocol_version: validateProtocolVersion(partialNotification['protocol_version']),
    event_list: validateConversationEvents(partialNotification['event_list'])
  };
}

/**
 * Validate a supported protocol version.
 * @param {*} protocolVersion
 * @returns {string}
 * @throws {Error}
 */
function validateProtocolVersion(protocolVersion) {
  validateString('Protocol version', protocolVersion);
  if (protocolVersion.toLowerCase() !== PROTOCOL_VERSION) {
    throw new Error('Unsupported protocol version: ' + protocolVersion);
  }
  return protocolVersion;
}

/**
 * Validate {@link ConversationEvent}s. Invalid {@link ConversationEvent}s will
 * be filtered.
 * @param {*} eventList
 * @returns {Array<ConversationEvent>}
 */
function validateConversationEvents(eventList) {
  return validateOr(validateArray.bind(null, 'Event list', eventList), [])
    .map(validateConversationEventOrNull)
    .filter(isNotNull);
}

/**
 * Validate {@link ConversationEvent}.
 * @param {*} conversationEvent
 * @returns {ConversationEvent}
 * @throws {Error}
 */
function validateConversationEvent(conversationEvent) {
  validateObject('Conversation Event', conversationEvent);
  var event = validateConversationEventType(conversationEvent['event']);
  conversationEvent = validateParticipantInfo(conversationEvent);
  conversationEvent.event = event;
  return conversationEvent;
}

/**
 * Validate {@link ConversationEvent} or return null.
 * @param {*} conversationEvent
 * @returns {?ConversationEvent}
 */
function validateConversationEventOrNull(conversationEvent) {
  return validateOr(validateConversationEvent.bind(null, conversationEvent), null);
}

/**
 * Validate {@link ConversationEvent} type. Invalid {@link ConversationEvent}
 * type returns null.
 * @param {*} conversationEventType
 * @returns {string}
 * @throws {Error}
 */
function validateConversationEventType(conversationEventType) {
  validateString('Conversation Event type', conversationEventType);
  switch (conversationEventType.toLowerCase()) {
    case 'participant_connected':
    case 'participant_disconnected':
    case 'track_added':
    case 'track_disabled':
    case 'track_enabled':
    case 'track_removed':
      return conversationEventType;
    default:
      throw new Error('Unknown Conversation Event type: ' + conversationEventType);
  }
}

/**
 * Validate instance version.
 * @param {*} instanceVesion
 * @returns {number}
 * @throws {Error}
 */
function validateInstanceVersion(instanceVersion) {
  return validateInteger('Instance version', instanceVersion);
}

/**
 * Parse a {@link FullNotification}.
 * @param {string|Object} notification
 * @returns {FullNotification}
 * @throws {Error}
 */
function parseFullNotification(stringOrJSON) {
  return validateFullNotification(parseStringOrJSON(stringOrJSON));
}

/**
 * Validate a {@link FullNotification}.
 * @param {*} fullNotification
 * @returns {FullNotification}
 * @throws {Error}
 */
function validateFullNotification(fullNotification) {
  validateObject('Full Notification', fullNotification);
  var conversationState = fullNotification['conversation_state'];
  fullNotification = validatePartialNotification(fullNotification);
  fullNotification.conversation_state = validateConversationState(conversationState);
  return fullNotification;
}

/**
 * Validate {@link ConversationState}.
 * @param {*} conversationState
 * @returns {ConversationState}
 * @throws {Error}
 */
function validateConversationState(conversationState) {
  validateObject('Conversation State', conversationState);
  return {
    instance_version: validateInstanceVersion(conversationState['instance_version']),
    sid: validateConversationSid(conversationState['sid']),
    participants: validateParticipantInfos(conversationState['participants'])
  };
}

/**
 * Validate a {@link Conversation} SID.
 * @param {*} conversationSid
 * @returns {string}
 * @throws {Error}
 */
function validateConversationSid(conversationSid) {
  return validateString('Conversation SID', conversationSid);
}

/**
 * Validate {@link ParticipantInfo}s. Invalid {@link ParticipantInfo}s will be
 * filtered.
 * @param {*} participantInfos
 * @returns {Array<ParticipantInfo>}
 */
function validateParticipantInfos(participantInfos) {
  return validateOr(validateArray.bind(null, 'Participants', participantInfos), [])
    .map(validateParticipantInfoOrNull)
    .filter(isNotNull);
}

/**
 * Validate {@link ParticipantInfo}.
 * @param {*} participantInfo
 * @returns {ParticipantInfo}
 * @throws {Error}
 */
function validateParticipantInfo(participantInfo) {
  validateObject('Participant Info', participantInfo);
  return {
    participant_sid: validateParticipantSid(participantInfo['participant_sid']),
    address: validateParticipantAddress(participantInfo['address']),
    tracks: validateTrackInfos(participantInfo['tracks'])
  };
}

/**
 * Validate {@link ParticipantInfo} or return null.
 * @param {*} participantInfo
 * @returns {?ParticipantInfo}
 */
function validateParticipantInfoOrNull(participantInfo) {
  return validateOr(validateParticipantInfo.bind(null, participantInfo), null);
}

/**
 * Validate a {@link Participant} SID.
 * @param {*} participantSid
 * @returns {string}
 * @throws Error
 */
function validateParticipantSid(participantSid) {
  return validateString('Participant SID', participantSid);
}

/**
 * Validate a {@link Participant} address.
 * @param {*} participantAddress
 * @returns {string}
 * @throws Error
 */
function validateParticipantAddress(participantAddress) {
  return validateString('Participant address', participantAddress);
}

/**
 * Validate {@link TrackInfo}s. Invalid {@link TrackInfo}s will be filtered.
 * @param {*} trackInfos
 * @returns {Array<TrackInfo>}
 */
function validateTrackInfos(trackInfos) {
  return validateOr(validateArray.bind(null, 'Tracks', trackInfos), [])
    .map(validateTrackInfoOrNull)
    .filter(isNotNull);
}

/**
 * Validate {@link Trackinfo}.
 * @param {*} trackInfo
 * @returns {TrackInfo}
 * @throws {Error}
 */
function validateTrackInfo(trackInfo) {
  validateObject('Track Info', trackInfo);
  return {
    id: validateTrackId(trackInfo['id']),
    kind: validateTrackKind(trackInfo['kind'])
  };
}

/**
 * Validate {@link TrackInfo} or return null.
 * @parma {*} trackInfo
 * @returns {?TrackInfo}
 */
function validateTrackInfoOrNull(trackInfo) {
  return validateOr(validateTrackInfo.bind(null, trackInfo), null);
}

/**
 * Validate a {@link Track} ID.
 * @param {*} id
 * @returns {string}
 * @throws {Error}
 */
function validateTrackId(id) {
  return validateString('Track ID', id);
}

/**
 * Validate a {@link Track} kind.
 * @param {*} kind
 * @returns {string}
 * @throws {Error}
 */
function validateTrackKind(kind) {
  validateString('Track kind', kind);
  switch (kind.toLowerCase()) {
    case 'audio':
    case 'video':
      return kind;
    default:
      throw new Error('Unknown Track kind: ' + kind);
  }
}

/**
 * Parse a string or JSON.
 * @param {String|Object} stringOrJSON
 * @returns {Object}
 * @throws {Error}
 */
function parseStringOrJSON(stringOrJSON) {
  return typeof stringOrJSON === 'object'
    ? stringOrJSON
    : parseJSON(stringOrJSON);
}

/**
 * Parse JSON.
 * @param {string}
 * @returns {Object}
 * @throws {Error}
 */
function parseJSON(string) {
  var json = JSON.parse(string);
  return validateObject('Full or Partial Notification', json);
}

/**
 * Validate a truth `value`.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validate(name, value) {
  if (!value) {
    throw new Error(name + ' is missing');
  }
  return value;
}

/**
 * Validate an instance of a class.
 * @param {*} value
 * @param {*} _class
 * @param {string} name
 * @param {string} className
 * @returns {*}
 * @throws {Error}
 */
function validateInstanceOf(value, _class, name, className) {
  if (!(value instanceof _class)) {
    throw new Error(name + ' is not ' + className + ': ' + value);
  }
  return value;
}

/**
 * Validate an Array.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateArray(name, value) {
  return validateInstanceOf(value, Array, name, 'an array');
}

/**
 * Validate an integer.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateInteger(name, value) {
  if (!Number.isInteger(value)) {
    throw new Error(name + ' is not an integer: ' + value);
  }
  return value;
}

/**
 * Validate an object.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateObject(name, value) {
  return validateInstanceOf(value, Object, name, 'an object');
}

/**
 * Validate a string.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateString(name, value) {
  if (typeof value !== 'string') {
    throw new Error(name + ' is not a string: ' + value);
  }
  return value;
}

/**
 * Run a validation. If it fails, return the default value.
 * @param {function} validation
 * @param {*} def
 * @returns {*}
 */
function validateOr(validation, def) {
  try {
    return validation();
  } catch (error) {
    return def;
  }
}

/**
 * Check if a value is strictly not equal to null.
 * @param {*} value
 * returns {boolean}
 */
function isNotNull(value) {
  return value !== null;
}

/**
 * Make a fake "participant_connected" Conversation Event.
 * @param {Dialog} dialog
 * @param {sid} participantSid
 * @returns {PartialNotification}
 */
function simulateParticipantConnectedEvent(dialog, participantSid) {
  return {
    "event_list": [
      {
        "event": "participant_connected",
        "participant_sid": participantSid,
        "address": dialog.remote,
        "tracks": []
      }
    ]
  };
}

/**
 * Make fake "participant_disconnected" Conversation Events.
 * @param {Map<string, Participant>} participants
 * @param {Dialog} dialog
 * @returns {PartialNotification}
 */
function simulateParticipantDisconnectedEvents(participants, dialog) {
  var eventList = [];

  participants.forEach(function(participant) {
    if (participant.address !== util.getUser(dialog.remote)) {
      return;
    }

    var tracks = [];

    participant.media.tracks.forEach(function(track) {
      tracks.push({
        "id": track.id,
        "kind": track.kind
      });
    });

    var event = {
      "event": "participant_disconnected",
      "participant_sid": participant.sid,
      "address": participant.address,
      "tracks": tracks
    };

    eventList.push(event);
  });

  return {
    "event_list": eventList
  };
}

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
  return {
    "protocol_version": PROTOCOL_VERSION,
    "type": "partial",
    "event_list": [
      {
        "event": event,
        "time_stamp": (new Date()).toUTCString(),
        "participant_sid": participantSid,
        "tracks": [
          {
            "kind": _track.kind,
            "id": _track.id
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

module.exports.isFullNotification = isFullNotification;
module.exports.isPartialNotification = isPartialNotification;
module.exports.parseFullNotification = parseFullNotification;
module.exports.parseNotification = parseNotification;
module.exports.parsePartialNotification = parsePartialNotification;
module.exports.simulateParticipantConnectedEvent = simulateParticipantConnectedEvent;
module.exports.simulateParticipantDisconnectedEvents = simulateParticipantDisconnectedEvents;
module.exports.trackDisabled = trackDisabled;
module.exports.trackEnabled = trackEnabled;
