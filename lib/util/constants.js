'use strict';

module.exports.DEFAULT_ENVIRONMENT = 'prod';
module.exports.DEFAULT_REALM = 'us1';
module.exports.DEFAULT_LOG_LEVEL = 'warn';
module.exports.REGISTRAR_SERVER = function(accountSid) { return accountSid + '.endpoint.twilio.com'; };
module.exports.WS_SERVER = function(environment, realm, accountSid) {
  switch (environment) {
    case 'prod':
      switch (realm) {
        case 'us1':
          return 'wss://' + accountSid + '.endpoint.twilio.com';
        default:
          return 'wss://' + accountSid + '.endpoint.' + realm + '.twilio.com';
      }
    default:
      return 'wss://' + accountSid + '.endpoint.' + environment + '-' + realm + '.twilio.com';
  }
};
module.exports.ECS_SERVER = function(environment, realm) {
  switch (environment) {
    case 'prod':
      return 'https://ecs.' + realm + '.twilio.com';
    default:
      return 'https://ecs.' + environment + '-' + realm + '.twilio.com';
  }
};
module.exports.ECS_TIMEOUT = 60;
module.exports.PUBLISH_MAX_ATTEMPTS = 5;
module.exports.PUBLISH_BACKOFF_MS = 10;

module.exports.ICE_SERVERS_TIMEOUT_MS = 3000;
module.exports.ICE_SERVERS_DEFAULT_TTL = 3600;
module.exports.DEFAULT_ICE_SERVERS = function(environment) {
  switch (environment) {
    case 'prod':
      return [
        { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
      ];
    default:
      return [
        { urls: 'stun:global.stun.' + environment + '.twilio.com:3478?transport=udp' }
      ];
  }
};

// Headers
/* eslint key-spacing:0 */
module.exports.headers = {
  X_TWILIO_ACCESSTOKEN:   'X-Twilio-AccessToken',
  X_TWILIO_PARTICIPANTS:  'X-Twilio-Participants',
  X_TWILIO_PARTICIPANTSID:'X-Twilio-ParticipantSid'
};

var TwilioError = require('./twilioerror');
var BASE_ERROR_CODES = {
  SIGNALING: 53000,
  ROOM: 53100,
  PARTICIPANT: 53200,
  TRACK: 53300,
  MEDIA: 53400,
  CONFIGURATION: 53500
};

module.exports.twilioErrors = [
  {
    category: 'SIGNALING',
    errors: [
      'CONNECTION_ERROR',
      'CONNECTION_DISCONNECTED',
      'CONNECTION_TIMEOUT',
      'INVALID_MESSAGE_RECEIVED',
      'INVALID_MESSAGE_SENT'
    ],
    messages: [
      'Signaling connection error',
      'Signaling connection disconnected',
      'Signaling connection timed out',
      'Client received an invalid signaling message',
      'Client sent an invalid signaling message'
    ]
  },
  {
    category: 'ROOM',
    errors: [
      'INVALID_NAME',
      'NAME_TOO_LONG',
      'INVALID_NAME_CHARS',
      'CREATE_FAILED',
      'CONNECT_FAILED',
      'TOO_MANY_PARTICIPANTS'
    ],
    messages: [
      'Room name is invalid',
      'Room name is too long',
      'Room name contains invalid characters',
      'Unable to create Room',
      'Unable to connect to Room',
      'Room contains too many Participants'
    ]
  },
  {
    category: 'PARTICIPANT',
    errors: [
      'INVALID_IDENTITY',
      'IDENTITY_TOO_LONG',
      'INVALID_IDENTITY_CHARS',
      'TOO_MANY_TRACKS'
    ],
    messages: [
      'Participant identity is invalid',
      'Participant identity is too long',
      'Participant identity contains invalid characters',
      'Participant has too many Tracks'
    ]
  },
  {
    category: 'TRACK',
    errors: [
      'INVALID',
      'INVALID_NAME',
      'NAME_TOO_LONG',
      'INVALID_NAME_CHARS'
    ],
    messages: [
      'Track is invalid',
      'Track name is invalid',
      'Track name is too long',
      'Track name contains invalid characters'
    ]
  },
  {
    category: 'MEDIA',
    errors: [
      'CLIENT_LOCAL_DESC_FAILED',
      'SERVER_LOCAL_DESC_FAILED',
      'CLIENT_REMOTE_DESC_FAILED',
      'SERVER_REMOTE_DESC_FAILED',
      'NO_SUPPORTED_CODEC'
    ],
    messages: [
      'Client is unable to create or apply a local media description',
      'Server is unable to create or apply a local media description',
      'Client is unable to apply a remote media description',
      'Server is unable to apply a remote media description',
      'No supported codec'
    ]
  },
  {
    category: 'CONFIGURATION',
    errors: [
      'ACQUIRE_FAILED',
      'ACQUIRE_TURN_FAILED'
    ],
    messages: [
      'Unable to acquire configuration',
      'Unable to acquire TURN credentials'
    ]
  }
].reduce(function(errors, data) {
  data.errors.forEach(function(name, i) {
    errors[data.category + '_' + name] =
      TwilioError.bind(null, BASE_ERROR_CODES[data.category] + i, data.messages[i]);
  });
  return errors;
}, { INVALID_ACCESSTOKEN: TwilioError.bind(null, 20101) });

/**
 * Returns the appropriate indefinite article ("a" | "an").
 * @param {string} word - The word which determines whether "a" | "an" is returned
 * @returns {string} "a" if word's first letter is a vowel, "an" otherwise
 */
function article(word) {
  // NOTE(mmalavalli): This will not be accurate for words like "hour",
  // which have consonants as their first character, but are pronounced like
  // vowels. We can address this issue if the need arises.
  return ['a', 'e', 'i', 'o', 'u'].indexOf(word.toLowerCase()[0]) >= 0 ? 'an' : 'a';
}

module.exports.typeErrors = {
  INVALID_TYPE: function(name, type) {
    return new TypeError(name + ' must be ' + article(type) + ' ' + type);
  },
  INVALID_VALUE: function(name, values) {
    return new RangeError(name + ' must be one of ', values.join(', '));
  },
  REQUIRED_ARGUMENT: function(name) {
    return new TypeError(name + ' must be specified');
  }
};
