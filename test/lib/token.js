'use strict';

var twilio = require('twilio');

/**
 * Credentials:
 *   accountSid
 *   configurationProfileSid
 *   signingKeySid
 *   signingKeySecret
 * Options:
 *   address - Name of client
 *   duration - Time in milliseconds the token should be good for
 */
function getAccessToken(credentials, options) {
  options = options || {};
  var accessTokenGenerator = new twilio.AccessToken(
    credentials.accountSid,
    credentials.signingKeySid,
    credentials.signingKeySecret,
    options.duration ? { ttl: options.duration } : {});
  accessTokenGenerator.identity = options.address;
  accessTokenGenerator.addGrant(
    new twilio.AccessToken.ConversationsGrant({
      configurationProfileSid: credentials.configurationProfileSid
    }));
  return accessTokenGenerator.toJwt();
}

module.exports.getToken = getAccessToken;
