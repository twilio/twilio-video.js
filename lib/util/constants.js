'use strict';

module.exports.DEFAULT_LOG_LEVEL = 'warn';
module.exports.REGISTRAR_SERVER = function(accountSid) { return accountSid + '.endpoint.twilio.com'; };
module.exports.WS_SERVER = function(accountSid) { return 'wss://' + accountSid + '.endpoint.twilio.com'; };

// Headers
/* eslint key-spacing:0 */
module.exports.headers = {
  X_TWILIO_ACCESSTOKEN:   'X-Twilio-AccessToken',
  X_TWILIO_PARTICIPANTS:  'X-Twilio-Participants',
  X_TWILIO_PARTICIPANTSID:'X-Twilio-ParticipantSid'
};

// Errors
// NOTE: This array is being reduced to a hash of TwilioErrors indexed by name
var TwilioError = require('./twilioerror');
module.exports.twilioErrors = Array.prototype.reduce.call([
  // Generic Network
  { name: 'GATEWAY_CONNECTION_FAILED', message: 'Could not connect to Twilio\'s servers' },
  { name: 'GATEWAY_DISCONNECTED', message: 'Connection to Twilio\'s servers was lost' },

  // Local Validation
  { name: 'INVALID_ARGUMENT', message: 'One or more arguments passed were invalid' },
  { name: 'INVALID_TOKEN', message: 'The token is invalid or malformed' },

  // Registration
  { name: 'LISTEN_FAILED', message: 'Failed to listen with the supplied token' },
  { name: 'TOKEN_EXPIRED', message: 'Client\'s active token has expired' },

  // Session Setup
  { name: 'CONVERSATION_CREATE_FAILED', message: 'Failed to create Conversation' },
  { name: 'CONVERSATION_INVITE_FAILED', message: 'Failed to add Participant to Conversation' },
  { name: 'CONVERSATION_INVITE_TIMEOUT', message: 'Invite to Participant timed out' },
  { name: 'CONVERSATION_INVITE_REJECTED', message: 'Invite was rejected by Participant' },
  { name: 'CONVERSATION_INVITE_CANCELED', message: 'Invite to Participant was canceled' },
  { name: 'CONVERSATION_JOIN_FAILED', message: 'Failed to join Conversation' },
  { name: 'CONVERSATION_JOIN_CANCELED', message: 'Incoming Invite was canceled by the sender' },
  { name: 'SDP_NEGOTIATION_FAILED', message: 'Failed to negotiate media with Participant(s)' },

  // ICE
  { name: 'ICE_CONNECT_FAILED', message: 'Could not find match for all candidates' },
  { name: 'ICE_DISCONNECTED', message: 'Liveliness check has failed; may be recoverable' },

  // Media
  { name: 'MEDIA_ACCESS_DENIED', message: 'Could not get access to microphone or camera' }
], function(errors, data) {
  errors[data.name] = new TwilioError(data);
  return errors;
}, { });
