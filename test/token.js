'use strict';

var https = require('https');
var twilio = require('twilio');
var Q = require('q');

/**
 * Generate a Signal token.
 * @param {string} accountSid - account SID
 * @param {string} authToken - authentication token
 * @param {string} address - the address to register
 * @returns {Promise<string>} Signal token
 */
function getLiveToken(accountSid, authToken, address, apiHost) {
  var stunTurnToken = Q.defer();

  apiHost = apiHost || 'api.twilio.com';
  var tokenUri = '/2010-04-01/Accounts/' + accountSid + '/Tokens.json';
  var options = {
    host: apiHost,
    path: tokenUri,
    method: 'POST',
    auth: accountSid + ':' + authToken,
    headers: { 'Content-Length': 0 }
  };

  var req = https.request(options, function(res) {
    var chunks = [];
    res.on('data', chunks.push.bind(chunks));
    res.on('end', function() {
      var data = chunks.join();
      try {
        stunTurnToken.resolve(JSON.parse(data));
      } catch (e) {
        stunTurnToken.reject(e);
      }
    });
  });
  req.on('error', stunTurnToken.reject);
  req.end();

  return withStunTurnToken(accountSid, authToken, address, stunTurnToken.promise);
}

var expiredToken = '{"username":"b45d0cba67b163d9004b8c4420514099b5780fe792b12825f55edae2d898cea1","password":"vf2qRCHPtV5IMlVIuSuMrJnkscpd6X3d4TnJXUXIGmc=","account_sid":"AC96ccc904753b3364f24211e8d9746a93","ttl":"86400","ice_servers":[{"url":"stun:global.stun.twilio.com:3478?transport=udp"},{"url":"turn:global.turn.twilio.com:3478?transport=udp","username":"b45d0cba67b163d9004b8c4420514099b5780fe792b12825f55edae2d898cea1","credential":"vf2qRCHPtV5IMlVIuSuMrJnkscpd6X3d4TnJXUXIGmc="}],"date_created":"Thu, 11 Dec 2014 18:23:10 +0000","date_updated":"Thu, 11 Dec 2014 18:23:10 +0000"}';

function getExpiredToken(accountSid, authToken, address, apiHost) {
  return withStunTurnToken(accountSid, authToken, address, Q(expiredToken));
}

function withStunTurnToken(accountSid, authToken, address, stunTurnToken) {
  return stunTurnToken.then(function(stunTurnToken) {
    var capabilityToken = new twilio.Capability(accountSid, authToken);
    capabilityToken.allowClientIncoming(address);
    return JSON.stringify({
      capabilityToken: capabilityToken.generate(),
      stunTurnToken: stunTurnToken
    });
  });
}

module.exports.getLiveToken = getLiveToken;
module.exports.getExpiredToken = getExpiredToken;
