var REALM        = module.exports.REALM        = '.dev';
var CHUNDER_PORT = module.exports.CHUNDER_PORT = 10193;

module.exports = {
  CLIENT_VERSION:   2,
  DEBUG:            false,
  REGISTRAR_SERVER: function(accountSid) { return 'twil.io'; },
  WS_SERVER:        function(accountSid) { return 'ws://public-sip0.us1.twilio.com'; }
};

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

// Errors
module.exports.errors = {
  NEEDS_CAPABILITY_TOKEN: new Error(
    'You must first call Device.setup() with a valid capability token'),
  NO_OUTGOING_CAPABILITY: new Error(
    'Your capability token does not allow you to make outgoing calls'),
  WRONG_NUMBER_OF_SEGMENTS: new Error(
    'Capability token string has the wrong number of segments'),
  BAD_SCOPE_URI: new Error(
    'Capability token contains an invalid scope URI'),
  OUTGOING_NO_APPSID: new Error(
    'Outgoing capability token must specify an app SID'),
  INCOMING_NO_CLIENT_NAME: new Error(
    'Incoming capability token must specify a client name'),
  NEITHER_INCOMING_NOR_OUTGOING: new Error(
    'Capability token supports neither incoming nor outgoing calls'),
  INVALID_CONNECT_TARGET: new Error(
    'Twilio.Device.connect called with invalid target'),
  INVALID_APP_SID: new Error(
    'Invalid application SID')
};

module.exports.DEFAULT_PEER_NAME = 'Anonymous';

// TODO(mroberts): Host these elsewhere.
var soundRoot = 'http://static.twilio.com/libs/twiliojs/refs/82278dd/sounds/';

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
