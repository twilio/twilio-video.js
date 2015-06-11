'use strict';

var jwt = require('jsonwebtoken');
var AccessToken = require('../../lib/accesstoken');

/**
 * Credentials:
 *   accountSid
 *   signingKeySid
 *   signingKeySecret
 * Options:
 *   address - Name of client
 *   duration - Time in milliseconds the token should be good for
 *   grants - An array of strings representing access grants
 */
function getAccessToken(credentials, options) {
  options = options || { };

  var now = new Date();

  var accountSid = credentials.accountSid;
  var signingKeySid = credentials.signingKeySid;
  var signingKeySecret = credentials.signingKeySecret;

  var address = options.address || null;
  var duration = options.duration || null;
  var grants = options.grants || ['invite', 'listen'];

  var anHourBeforeNow = new Date(now.getTime());
  anHourBeforeNow.setHours(anHourBeforeNow.getHours() - 1);

  var anHourFromNow = new Date(now.getTime());
  anHourFromNow.setHours(anHourFromNow.getHours() + 1);

  var expires = duration ? now.getTime() + duration : 0;

  var payload = {
    sub: accountSid,
    iss: signingKeySid,
    grants: [
      { res: 'https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Tokens.json',
        act: [ 'POST' ] }
    ],
    exp: (expires ? expires : anHourFromNow) / 1000,
    nbf: anHourBeforeNow / 1000
  };

  if (address) {
    payload.grants.push({
      res: 'sip:' + address + '@' + accountSid + '.endpoint.twilio.com',
      act: grants
    });
  }

  return new AccessToken(jwt.sign(payload, signingKeySecret, {
    headers: {
      cty: 'twilio-sat;v=1'
    },
    noTimestamp: true
  }));
}

module.exports.getToken = getAccessToken;
