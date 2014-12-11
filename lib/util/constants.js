var REALM        = module.exports.REALM        = '.dev';
var CHUNDER_PORT = module.exports.CHUNDER_PORT = 10193;

module.exports = {
  // CHUNDER_HOST:   'chunderm' + REALM + '.twilio.com:' + CHUNDER_PORT,
  CLIENT_VERSION: 2,
  WS_SERVER:      'chunderm.twilio.com'
};

// Headers
module.exports.headers = {
  X_TWILIO_ACCOUNTSID:    'X-Twilio-Accountsid',
  X_TWILIO_APIVERSION:    'X-Twilio-Apiversion',
  X_TWILIO_CALLSID:       'X-Twilio-Callsid',
  X_TWILIO_CLIENT:        'X-Twilio-Client',
  X_TWILIO_CLIENTVERSION: 'X-Twilio-Clientversion',
  X_TWILIO_PARAMS:        'X-Twilio-Params',
  X_TWILIO_TOKEN:         'X-Twilio-Token'
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
