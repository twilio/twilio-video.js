'use strict';

var jwt = require('jsonwebtoken');
var ScopedAuthenticationToken = require('../lib/scopedauthenticationtoken');

function getScopedAuthenticationToken(accountSid, signingKeySid, signingKeySecret, address) {
  var now = new Date();
  var anHourBeforeNow = new Date(now.getTime());
  anHourBeforeNow.setHours(anHourBeforeNow.getHours() - 1);
  var anHourFromNow = new Date(now.getTime());
  anHourFromNow.setHours(anHourFromNow.getHours() + 1);
  var payload = {
    sub: accountSid,
    iss: signingKeySid,
    grants: [
      { res: 'https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Tokens.json',
        act: [ 'POST' ] },
      { res: 'sip:' + address + '@' + accountSid + '.endpoint.twilio.com',
        act: [ 'invite', 'listen' ] }
    ],
    exp: anHourFromNow / 1000,
    nbf: anHourBeforeNow / 1000,
  };
  return new ScopedAuthenticationToken(jwt.sign(payload, signingKeySecret, {
    headers: {
      cty: 'twilio-sat;v=1'
    },
    noTimestamp: true
  }));
}

module.exports.getToken = getScopedAuthenticationToken;
