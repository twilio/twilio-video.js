'use strict';

var Q = require('q');
var https = require('https');

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
    var twilio = require('twilio');
    var capabilityToken = new twilio.Capability(accountSid, authToken);
    capabilityToken.allowClientIncoming(address);
    capabilityToken.allowClientOutgoing('AP00000000000000000000000000000000');
    return JSON.stringify({
      "capability_token": capabilityToken.generate(),
      "stun_turn_token": stunTurnToken
    });
  });
}

function getBrowserToken(accountSid, authToken, address) {
  var deferred = Q.defer();
  var xhr = new XMLHttpRequest();
  xhr.open('GET',
    'https://twilio:video@simple-signaling.appspot.com/token?name=' +
    encodeURIComponent(address), true);
  xhr.ontimeout = function ontimeout() {
    deferred.reject(new Error('Timed-out getting token from server'));
  };
  xhr.onreadystatechange = function onreadystatechange() {
    if (xhr.readyState === 4) {
      switch (xhr.status) {
        case 200:
          try {
            deferred.resolve(JSON.stringify(JSON.parse(xhr.responseText)));
          } catch (e) {
            deferred.reject(e);
          }
          return;
        default:
          deferred.reject(new Error('Getting token from server failed with "' +
            xhr.status + ' ' + xhr.statusText + '"'));
      }
    }
  };
  xhr.send();
  return deferred.promise;
}

module.exports.getLiveToken = getLiveToken;
module.exports.getExpiredToken = getExpiredToken;
module.exports.getBrowserToken = getBrowserToken;
