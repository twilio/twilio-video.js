'use strict';

var validation = require('../util/validation');

/**
 * JSON conformant to version 1 of the application/conversation-info+json
 * content-type.
 * @typedef ConversationInfo
 * @type {object}
 */

var PROTOCOL_VERSION = 'v1';

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
  notification = validation.validateOr(validation.parseStringOrJSON.bind(null, notification), false);
  return notification && 'conversation_state' in notification;
}

/**
 * Parse a {@link FullNotification} or a {@link PartialNotification}.
 * @param {string|Object} notification
 * @returns {FullNotification|PartialNotification}
 * @throws {Error}
 */
function parseNotification(stringOrJSON) {
  var notification = validation.parseStringOrJSON(stringOrJSON);
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
  return validatePartialNotification(validation.parseStringOrJSON(stringOrJSON));
}

/**
 * Validate a {@link PartialNotification}.
 * @param {*} partialNotification
 * @returns {PartialNotification}
 * @throws {Error}
 */
function validatePartialNotification(partialNotification) {
  validation.validateObject('Partial Notification', partialNotification);
  /* eslint camelcase:0, dot-notation:0 */
  return {
    peer_connections: validatePeerConnections(partialNotification['peer_connections']),
    protocol_version: validateProtocolVersion(partialNotification['protocol_version']),
    event_list: validateConversationEvents(partialNotification['event_list'])
  };
}

// NOTE(mroberts): Writing out all these validations manually sucks. Let's move
// to some tool that autogenerates these in the future.
function validatePeerConnections(peerConnections) {
  return peerConnections;
}

/**
 * Validate a supported protocol version.
 * @param {*} protocolVersion
 * @returns {string}
 * @throws {Error}
 */
function validateProtocolVersion(protocolVersion) {
  validation.validateString('Protocol version', protocolVersion);
  if (['v1', 'v2'].indexOf(protocolVersion.toLowerCase()) === -1) {
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
  return validation.validateOr(validation.validateArray.bind(null, 'Event list', eventList), [])
    .map(validateConversationEventOrNull)
    .filter(validation.isNotNull);
}

/**
 * Validate {@link ConversationEvent}.
 * @param {*} conversationEvent
 * @returns {ConversationEvent}
 * @throws {Error}
 */
function validateConversationEvent(conversationEvent) {
  validation.validateObject('Conversation Event', conversationEvent);
  /* eslint dot-notation:0 */
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
  return validation.validateOr(validateConversationEvent.bind(null, conversationEvent), null);
}

/**
 * Validate {@link ConversationEvent} type. Invalid {@link ConversationEvent}
 * type returns null.
 * @param {*} conversationEventType
 * @returns {string}
 * @throws {Error}
 */
function validateConversationEventType(conversationEventType) {
  validation.validateString('Conversation Event type', conversationEventType);
  switch (conversationEventType.toLowerCase()) {
    case 'participant_connected':
    case 'participant_disconnected':
    case 'participant_failed':
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
  return validation.validateInteger('Instance version', instanceVersion);
}

/**
 * Parse a {@link FullNotification}.
 * @param {string|Object} notification
 * @returns {FullNotification}
 * @throws {Error}
 */
function parseFullNotification(stringOrJSON) {
  return validateFullNotification(validation.parseStringOrJSON(stringOrJSON));
}

/**
 * Validate a {@link FullNotification}.
 * @param {*} fullNotification
 * @returns {FullNotification}
 * @throws {Error}
 */
function validateFullNotification(fullNotification) {
  validation.validateObject('Full Notification', fullNotification);
  /* eslint dot-notation:0 */
  var conversationState = fullNotification['conversation_state'];
  fullNotification = validatePartialNotification(fullNotification);
  fullNotification.conversation_state = validateConversationState(conversationState);
  fullNotification.peer_connections = validatePeerConnections(fullNotification['peer_connections']);
  return fullNotification;
}

/**
 * Validate {@link ConversationState}.
 * @param {*} conversationState
 * @returns {ConversationState}
 * @throws {Error}
 */
function validateConversationState(conversationState) {
  validation.validateObject('Conversation State', conversationState);
  /* eslint camelcase:0, dot-notation:0 */
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
  return validation.validateString('Conversation SID', conversationSid);
}

/**
 * Validate {@link ParticipantInfo}s. Invalid {@link ParticipantInfo}s will be
 * filtered.
 * @param {*} participantInfos
 * @returns {Array<ParticipantInfo>}
 */
function validateParticipantInfos(participantInfos) {
  return validation.validateOr(validation.validateArray.bind(null, 'Participants', participantInfos), [])
    .map(validateParticipantInfoOrNull)
    .filter(validation.isNotNull);
}

/**
 * Validate {@link ParticipantInfo}.
 * @param {*} participantInfo
 * @returns {ParticipantInfo}
 * @throws {Error}
 */
function validateParticipantInfo(participantInfo) {
  validation.validateObject('Participant Info', participantInfo);
  /* eslint camelcase:0, dot-notation:0 */
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
  return validation.validateOr(validateParticipantInfo.bind(null, participantInfo), null);
}

/**
 * Validate a {@link Participant} SID.
 * @param {*} participantSid
 * @returns {string}
 * @throws Error
 */
function validateParticipantSid(participantSid) {
  return validation.validateString('Participant SID', participantSid);
}

/**
 * Validate a {@link Participant} address.
 * @param {*} participantAddress
 * @returns {string}
 * @throws Error
 */
function validateParticipantAddress(participantAddress) {
  return validation.validateString('Participant address', participantAddress);
}

/**
 * Validate {@link TrackInfo}s. Invalid {@link TrackInfo}s will be filtered.
 * @param {*} trackInfos
 * @returns {Array<TrackInfo>}
 */
function validateTrackInfos(trackInfos) {
  return validation.validateOr(validation.validateArray.bind(null, 'Tracks', trackInfos), [])
    .map(validateTrackInfoOrNull)
    .filter(validation.isNotNull);
}

/**
 * Validate {@link Trackinfo}.
 * @param {*} trackInfo
 * @returns {TrackInfo}
 * @throws {Error}
 */
function validateTrackInfo(trackInfo) {
  validation.validateObject('Track Info', trackInfo);
  /* eslint dot-notation:0 */
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
  return validation.validateOr(validateTrackInfo.bind(null, trackInfo), null);
}

/**
 * Validate a {@link Track} ID.
 * @param {*} id
 * @returns {string}
 * @throws {Error}
 */
function validateTrackId(id) {
  return validation.validateString('Track ID', id);
}

/**
 * Validate a {@link Track} kind.
 * @param {*} kind
 * @returns {string}
 * @throws {Error}
 */
function validateTrackKind(kind) {
  validation.validateString('Track kind', kind);
  switch (kind.toLowerCase()) {
    case 'audio':
    case 'video':
      return kind;
    default:
      throw new Error('Unknown Track kind: ' + kind);
  }
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

module.exports.isFullNotification = isFullNotification;
module.exports.isPartialNotification = isPartialNotification;
module.exports.parseFullNotification = parseFullNotification;
module.exports.parseNotification = parseNotification;
module.exports.parsePartialNotification = parsePartialNotification;
module.exports.trackDisabled = trackDisabled;
module.exports.trackEnabled = trackEnabled;
