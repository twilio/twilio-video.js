var REALM        = module.exports.REALM        = '.dev';
var CHUNDER_PORT = module.exports.CHUNDER_PORT = 10193;

module.exports = {
  CHUNDER_HOST:   'chunderm' + REALM + '.twilio.com:' + CHUNDER_PORT,
  CLIENT_VERSION: 2,
  WS_SERVER:      'ws://ec2-204-236-200-177.compute-1.amazonaws.com'
};

module.exports.ERROR_NEEDS_CAPABILITY_TOKEN = new Error(
  'You must first call Device.setup() with a valid capability token');
module.exports.ERROR_NO_OUTGOING_CAPABILITY = new Error(
  'Your capability token does not allow you to make outgoing calls');
module.exports.ERROR_WRONG_NUMBER_OF_SEGMENTS = new Error(
  'Capability token string has the wrong number of segments');
module.exports.ERROR_BAD_SCOPE_URI = new Error(
  'Capability token contains an invalid scope URI');
module.exports.ERROR_OUTGOING_NO_APPSID = new Error(
  'Outgoing capability token must specify an app SID');
module.exports.ERROR_INCOMING_NO_CLIENT_NAME = new Error(
  'Incoming capability token must specify a client name');
module.exports.ERROR_NEITHER_INCOMING_NOR_OUTGOING = new Error(
  'Capability token supports neither incoming nor outgoing calls');
module.exports.ERROR_INVALID_CONNECT_TARGET = new Error(
  'Twilio.Device.connect called with invalid target');
module.exports.ERROR_INVALID_APP_SID = new Error(
  'Invalid application SID');
