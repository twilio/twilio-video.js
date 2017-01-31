'use strict';

var inherits = require('util').inherits;
var TwilioError = require('./twilioerror');

/**
 * @class AccessTokenInvalidError
 * @classdesc Raised whenever the AccessToken used for connecting to a room is invalid.
 * @property {number} code - 20101
 * @property {string} message - 'Invalid Access Token'
 */
function AccessTokenInvalidError() {
  TwilioError.call(this,
    20101,
    'Invalid Access Token'
  );
}
inherits(AccessTokenInvalidError, TwilioError);
exports.AccessTokenInvalidError = AccessTokenInvalidError;

/**
 * @class SignalingConnectionError
 * @classdesc Raised whenever a signaling connection error occurs that is not covered by a more specific error code.
 * @property {number} code - 53000
 * @property {string} message - 'Signaling connection error'
 */
function SignalingConnectionError() {
  TwilioError.call(this,
    53000,
    'Signaling connection error'
  );
}
inherits(SignalingConnectionError, TwilioError);
exports.SignalingConnectionError = SignalingConnectionError;

/**
 * @class SignalingConnectionDisconnectedError
 * @classdesc Raised whenever the signaling connection is unexpectedly disconnected.
 * @property {number} code - 53001
 * @property {string} message - 'Signaling connection disconnected'
 */
function SignalingConnectionDisconnectedError() {
  TwilioError.call(this,
    53001,
    'Signaling connection disconnected'
  );
}
inherits(SignalingConnectionDisconnectedError, TwilioError);
exports.SignalingConnectionDisconnectedError = SignalingConnectionDisconnectedError;

/**
 * @class SignalingConnectionTimeoutError
 * @classdesc Raised whenever the signaling connection times out.
 * @property {number} code - 53002
 * @property {string} message - 'Signaling connection timed out'
 */
function SignalingConnectionTimeoutError() {
  TwilioError.call(this,
    53002,
    'Signaling connection timed out'
  );
}
inherits(SignalingConnectionTimeoutError, TwilioError);
exports.SignalingConnectionTimeoutError = SignalingConnectionTimeoutError;

/**
 * @class SignalingIncomingMessageInvalidError
 * @classdesc Raised whenever the Client receives a message from the Server that the Client cannot handle.
 * @property {number} code - 53003
 * @property {string} message - 'Client received an invalid signaling message'
 */
function SignalingIncomingMessageInvalidError() {
  TwilioError.call(this,
    53003,
    'Client received an invalid signaling message'
  );
}
inherits(SignalingIncomingMessageInvalidError, TwilioError);
exports.SignalingIncomingMessageInvalidError = SignalingIncomingMessageInvalidError;

/**
 * @class SignalingOutgoingMessageInvalidError
 * @classdesc Raised whenever the Client sends a message to the Server that the Server cannot handle.
 * @property {number} code - 53004
 * @property {string} message - 'Client sent an invalid signaling message'
 */
function SignalingOutgoingMessageInvalidError() {
  TwilioError.call(this,
    53004,
    'Client sent an invalid signaling message'
  );
}
inherits(SignalingOutgoingMessageInvalidError, TwilioError);
exports.SignalingOutgoingMessageInvalidError = SignalingOutgoingMessageInvalidError;

/**
 * @class RoomNameInvalidError
 * @classdesc Raised whenever a Room name is invalid, and the scenario is not covered by a more specific error code.
 * @property {number} code - 53100
 * @property {string} message - 'Room name is invalid'
 */
function RoomNameInvalidError() {
  TwilioError.call(this,
    53100,
    'Room name is invalid'
  );
}
inherits(RoomNameInvalidError, TwilioError);
exports.RoomNameInvalidError = RoomNameInvalidError;

/**
 * @class RoomNameTooLongError
 * @classdesc Raised whenever a Room name is too long.
 * @property {number} code - 53101
 * @property {string} message - 'Room name is too long'
 */
function RoomNameTooLongError() {
  TwilioError.call(this,
    53101,
    'Room name is too long'
  );
}
inherits(RoomNameTooLongError, TwilioError);
exports.RoomNameTooLongError = RoomNameTooLongError;

/**
 * @class RoomNameCharsInvalidError
 * @classdesc Raised whenever a Room name contains invalid characters.
 * @property {number} code - 53102
 * @property {string} message - 'Room name contains invalid characters'
 */
function RoomNameCharsInvalidError() {
  TwilioError.call(this,
    53102,
    'Room name contains invalid characters'
  );
}
inherits(RoomNameCharsInvalidError, TwilioError);
exports.RoomNameCharsInvalidError = RoomNameCharsInvalidError;

/**
 * @class RoomCreateFailedError
 * @classdesc Raised whenever the Server is unable to create a Room.
 * @property {number} code - 53103
 * @property {string} message - 'Unable to create Room'
 */
function RoomCreateFailedError() {
  TwilioError.call(this,
    53103,
    'Unable to create Room'
  );
}
inherits(RoomCreateFailedError, TwilioError);
exports.RoomCreateFailedError = RoomCreateFailedError;

/**
 * @class RoomConnectFailedError
 * @classdesc Raised whenever a Client is unable to connect to a Room, and the scenario is not covered by a more specific error code.
 * @property {number} code - 53104
 * @property {string} message - 'Unable to connect to Room'
 */
function RoomConnectFailedError() {
  TwilioError.call(this,
    53104,
    'Unable to connect to Room'
  );
}
inherits(RoomConnectFailedError, TwilioError);
exports.RoomConnectFailedError = RoomConnectFailedError;

/**
 * @class RoomMaxParticipantsExceededError
 * @classdesc Raised whenever a Client is unable to connect to a Room because the Room contains too many Participants.
 * @property {number} code - 53105
 * @property {string} message - 'Room contains too many Participants'
 */
function RoomMaxParticipantsExceededError() {
  TwilioError.call(this,
    53105,
    'Room contains too many Participants'
  );
}
inherits(RoomMaxParticipantsExceededError, TwilioError);
exports.RoomMaxParticipantsExceededError = RoomMaxParticipantsExceededError;

/**
 * @class RoomNotFoundError
 * @classdesc Raised whenever attempting operation on a non-existent Room.
 * @property {number} code - 53106
 * @property {string} message - 'Room not found'
 */
function RoomNotFoundError() {
  TwilioError.call(this,
    53106,
    'Room not found'
  );
}
inherits(RoomNotFoundError, TwilioError);
exports.RoomNotFoundError = RoomNotFoundError;

/**
 * @class ParticipantIdentityInvalidError
 * @classdesc Raised whenever a Participant identity is invalid, and the scenario is not covered by a more specific error code.
 * @property {number} code - 53200
 * @property {string} message - 'Participant identity is invalid'
 */
function ParticipantIdentityInvalidError() {
  TwilioError.call(this,
    53200,
    'Participant identity is invalid'
  );
}
inherits(ParticipantIdentityInvalidError, TwilioError);
exports.ParticipantIdentityInvalidError = ParticipantIdentityInvalidError;

/**
 * @class ParticipantIdentityTooLongError
 * @classdesc Raised whenever a Participant identity is too long.
 * @property {number} code - 53201
 * @property {string} message - 'Participant identity is too long'
 */
function ParticipantIdentityTooLongError() {
  TwilioError.call(this,
    53201,
    'Participant identity is too long'
  );
}
inherits(ParticipantIdentityTooLongError, TwilioError);
exports.ParticipantIdentityTooLongError = ParticipantIdentityTooLongError;

/**
 * @class ParticipantIdentityCharsInvalidError
 * @classdesc Raised whenever a Participant identity contains invalid characters.
 * @property {number} code - 53202
 * @property {string} message - 'Participant identity contains invalid characters'
 */
function ParticipantIdentityCharsInvalidError() {
  TwilioError.call(this,
    53202,
    'Participant identity contains invalid characters'
  );
}
inherits(ParticipantIdentityCharsInvalidError, TwilioError);
exports.ParticipantIdentityCharsInvalidError = ParticipantIdentityCharsInvalidError;

/**
 * @class ParticipantMaxTracksExceededError
 * @classdesc Raised whenever a Participant has too many Tracks.
 * @property {number} code - 53203
 * @property {string} message - 'Participant has too many Tracks'
 */
function ParticipantMaxTracksExceededError() {
  TwilioError.call(this,
    53203,
    'Participant has too many Tracks'
  );
}
inherits(ParticipantMaxTracksExceededError, TwilioError);
exports.ParticipantMaxTracksExceededError = ParticipantMaxTracksExceededError;

/**
 * @class ParticipantNotFoundError
 * @classdesc Raised whenever attempting operation on a non-existent Participant.
 * @property {number} code - 53204
 * @property {string} message - 'Participant not found'
 */
function ParticipantNotFoundError() {
  TwilioError.call(this,
    53204,
    'Participant not found'
  );
}
inherits(ParticipantNotFoundError, TwilioError);
exports.ParticipantNotFoundError = ParticipantNotFoundError;

/**
 * @class TrackInvalidError
 * @classdesc Raised whenever a Track is invalid, and the scenario is not covered by a more specific error code.
 * @property {number} code - 53300
 * @property {string} message - 'Track is invalid'
 */
function TrackInvalidError() {
  TwilioError.call(this,
    53300,
    'Track is invalid'
  );
}
inherits(TrackInvalidError, TwilioError);
exports.TrackInvalidError = TrackInvalidError;

/**
 * @class TrackNameInvalidError
 * @classdesc Raised whenever a Track name is invalid, and the scenario is not covered by a more specific error code.
 * @property {number} code - 53301
 * @property {string} message - 'Track name is invalid'
 */
function TrackNameInvalidError() {
  TwilioError.call(this,
    53301,
    'Track name is invalid'
  );
}
inherits(TrackNameInvalidError, TwilioError);
exports.TrackNameInvalidError = TrackNameInvalidError;

/**
 * @class TrackNameTooLongError
 * @classdesc Raised whenever a Track name is too long.
 * @property {number} code - 53302
 * @property {string} message - 'Track name is too long'
 */
function TrackNameTooLongError() {
  TwilioError.call(this,
    53302,
    'Track name is too long'
  );
}
inherits(TrackNameTooLongError, TwilioError);
exports.TrackNameTooLongError = TrackNameTooLongError;

/**
 * @class TrackNameCharsInvalidError
 * @classdesc Raised whenever a Track name contains invalid characters.
 * @property {number} code - 53303
 * @property {string} message - 'Track name contains invalid characters'
 */
function TrackNameCharsInvalidError() {
  TwilioError.call(this,
    53303,
    'Track name contains invalid characters'
  );
}
inherits(TrackNameCharsInvalidError, TwilioError);
exports.TrackNameCharsInvalidError = TrackNameCharsInvalidError;

/**
 * @class MediaClientLocalDescFailedError
 * @classdesc Raised whenever a Client is unable to create or apply a local media description.
 * @property {number} code - 53400
 * @property {string} message - 'Client is unable to create or apply a local media description'
 */
function MediaClientLocalDescFailedError() {
  TwilioError.call(this,
    53400,
    'Client is unable to create or apply a local media description'
  );
}
inherits(MediaClientLocalDescFailedError, TwilioError);
exports.MediaClientLocalDescFailedError = MediaClientLocalDescFailedError;

/**
 * @class MediaServerLocalDescFailedError
 * @classdesc Raised whenever the Server is unable to create or apply a local media description.
 * @property {number} code - 53401
 * @property {string} message - 'Server is unable to create or apply a local media description'
 */
function MediaServerLocalDescFailedError() {
  TwilioError.call(this,
    53401,
    'Server is unable to create or apply a local media description'
  );
}
inherits(MediaServerLocalDescFailedError, TwilioError);
exports.MediaServerLocalDescFailedError = MediaServerLocalDescFailedError;

/**
 * @class MediaClientRemoteDescFailedError
 * @classdesc Raised whenever the Client receives a remote media description but is unable to apply it.
 * @property {number} code - 53402
 * @property {string} message - 'Client is unable to apply a remote media description'
 */
function MediaClientRemoteDescFailedError() {
  TwilioError.call(this,
    53402,
    'Client is unable to apply a remote media description'
  );
}
inherits(MediaClientRemoteDescFailedError, TwilioError);
exports.MediaClientRemoteDescFailedError = MediaClientRemoteDescFailedError;

/**
 * @class MediaServerRemoteDescFailedError
 * @classdesc Raised whenever the Server receives a remote media description but is unable to apply it.
 * @property {number} code - 53403
 * @property {string} message - 'Server is unable to apply a remote media description'
 */
function MediaServerRemoteDescFailedError() {
  TwilioError.call(this,
    53403,
    'Server is unable to apply a remote media description'
  );
}
inherits(MediaServerRemoteDescFailedError, TwilioError);
exports.MediaServerRemoteDescFailedError = MediaServerRemoteDescFailedError;

/**
 * @class MediaNoSupportedCodecError
 * @classdesc Raised whenever the intersection of codecs supported by the Client and the Server (or, in peer-to-peer, the Client and another Participant) is empty.
 * @property {number} code - 53404
 * @property {string} message - 'No supported codec'
 */
function MediaNoSupportedCodecError() {
  TwilioError.call(this,
    53404,
    'No supported codec'
  );
}
inherits(MediaNoSupportedCodecError, TwilioError);
exports.MediaNoSupportedCodecError = MediaNoSupportedCodecError;

/**
 * @class ConfigurationAcquireFailedError
 * @classdesc Raised whenever the Client is unable to acquire configuration information from the Server.
 * @property {number} code - 53500
 * @property {string} message - 'Unable to acquire configuration'
 */
function ConfigurationAcquireFailedError() {
  TwilioError.call(this,
    53500,
    'Unable to acquire configuration'
  );
}
inherits(ConfigurationAcquireFailedError, TwilioError);
exports.ConfigurationAcquireFailedError = ConfigurationAcquireFailedError;

/**
 * @class ConfigurationAcquireTurnFailedError
 * @classdesc Raised whenever the Server is unable to return TURN credentials to the Client
 * @property {number} code - 53501
 * @property {string} message - 'Unable to acquire TURN credentials'
 */
function ConfigurationAcquireTurnFailedError() {
  TwilioError.call(this,
    53501,
    'Unable to acquire TURN credentials'
  );
}
inherits(ConfigurationAcquireTurnFailedError, TwilioError);
exports.ConfigurationAcquireTurnFailedError = ConfigurationAcquireTurnFailedError;


