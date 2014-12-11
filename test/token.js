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
function getToken(accountSid, authToken, address, apiHost) {
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

  return stunTurnToken.promise.then(function(stunTurnToken) {
    var capabilityToken = new twilio.Capability(accountSid, authToken);
    capabilityToken.allowClientIncoming(address);
    return JSON.stringify({
      capabilityToken: capabilityToken.generate(),
      stunTurnToken: stunTurnToken
    });
  });
}

module.exports = getToken;
