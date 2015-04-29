module.exports.REALM = '.dev';
module.exports.CHUNDER_PORT = 10193;
module.exports.CLIENT_VERSION = 2;
module.exports.DEBUG = false;
module.exports.EVENT_GATEWAY = 'eventgw.twilio.com';
module.exports.REGISTRAR_SERVER = function(accountSid) { return 'twil.io'; };
module.exports.WS_SERVER = function(accountSid) { return 'wss://public-endpoint0.us1.twilio.com'; };
module.exports.DEFAULT_PEER_NAME = 'Anonymous';
module.exports.DEFAULT_CALL_TIMEOUT = 30000;

// Headers
module.exports.headers = {
  X_TWILIO_ACCOUNTSID:    'X-Twilio-Accountsid',
  X_TWILIO_APIVERSION:    'X-Twilio-Apiversion',
  X_TWILIO_CALLSID:       'X-Twilio-Callsid',
  X_TWILIO_CLIENT:        'X-Twilio-Client',
  X_TWILIO_CLIENTVERSION: 'X-Twilio-Clientversion',
  X_TWILIO_PARAMS:        'X-Twilio-Params',
  X_TWILIO_TOKEN:         'X-Twilio-Token',
  // VSS
  X_TWILIO_USERNAME:      'X-Twilio-Username',
  X_TWILIO_PASSWORD:      'X-Twilio-Password',
  X_TWILIO_SESSION:       'X-Twilio-Session'
};

// TODO(mroberts): Host these elsewhere.
var soundRoot = '//static.twilio.com/libs/twiliojs/refs/82278dd/sounds/';

module.exports.SOUNDS = {
  incoming: soundRoot + 'incoming.mp3',
  outgoing: soundRoot + 'outgoing.mp3',
  disconnect: soundRoot + 'disconnect.mp3',
  dtmf0: soundRoot + 'dtmf-0.mp3',
  dtmf1: soundRoot + 'dtmf-1.mp3',
  dtmf2: soundRoot + 'dtmf-2.mp3',
  dtmf3: soundRoot + 'dtmf-3.mp3',
  dtmf4: soundRoot + 'dtmf-4.mp3',
  dtmf5: soundRoot + 'dtmf-5.mp3',
  dtmf6: soundRoot + 'dtmf-6.mp3',
  dtmf7: soundRoot + 'dtmf-7.mp3',
  dtmf8: soundRoot + 'dtmf-8.mp3',
  dtmf9: soundRoot + 'dtmf-9.mp3',
};

// Errors
// NOTE: This array is being reduced to a hash of TwilioErrors indexed by name
var TwilioError = require('./twilioerror');
module.exports.twilioErrors = Array.prototype.reduce.call([
  // Generic
  {
    code: 32000,
    id: 'UNKNOWN_ERROR',
    defaultMessage: 'An unexpected error has been thrown'
  },
  {
    code: 32005,
    id: 'INVALID_ARGUMENT',
    defaultMessage: 'One or more arguments passed were invalid'
  },
  {
    code: 32010,
    id: 'INVALID_TOKEN',
    defaultMessage: 'The token is invalid or malformed'
  },

  // Generic Network
  {
    code: 32100,
    id: 'UNKNOWN_NETWORK_ERROR',
    defaultMessage: 'The gateway returned an unexpected error'
  },
  {
    code: 32105,
    id: 'SERVICE_UNAVAILABLE',
    defaultMessage: 'Could not connect to Twilio gateway'
  },

  // Registration
  {
    code: 32200,
    id: 'REGISTER_FAILED',
    defaultMessage: 'Failed to register with the supplied token'
  },

  // Session Setup
  {
    code: 32300,
    id: 'SESSION_CONNECT_FAILED',
    defaultMessage: 'Failed to establish a connection with the remote endpoint'
  },
  {
    code: 32305,
    id: 'CONVERSATION_JOIN_FAILED',
    defaultMessage: 'Failed to join conversation'
  },
  {
    code: 32310,
    id: 'SDP_NEGOTIATION_FAILED',
    defaultMessage: 'Failed to negotiate media connection with peer'
  },

  // ICE
  {
    code: 32400,
    id: 'ICE_CONNECT_FAILED',
    defaultMessage: 'ICE Connection Failed'
  },
  {
    code: 32405,
    id: 'ICE_DISCONNECTED',
    defaultMessage: 'ICE Connection Disconnected'
  },

  // Media
  {
    code: 32500,
    id: 'MEDIA_ACCESS_FAILED',
    defaultMessage: 'Could not get access to access to microphone or camera'
  },

  // JS-Only
  {
    code: 32660,
    id: 'STREAM_ATTACH_FAILED',
    defaultMessage: 'Failed to attach Stream to DOM'
  }
], function(errors, data) {
  errors[data.id] = new TwilioError(data);
  return errors;
}, { });
