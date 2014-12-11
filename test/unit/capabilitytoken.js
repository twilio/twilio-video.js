var exec = require('child_process').exec;
var twilio = require('twilio');

var CapabilityToken = require('../../lib/token/capabilitytoken')
var constants = require('../../lib/util/constants');
var util = require('../../lib/util');

var ACCOUNT_SID = 'AC123';
var AUTH_TOKEN = '45678';

describe('CapabilityToken', function() {

  it('should parse incoming capability tokens', function(done) {
    getCapabilityToken('mark', null, null, done, function(capabilityToken) {
      if (!capabilityToken.supportsIncoming)
        done(new Error('Parsed capability token should support incoming'));
      else if (!capabilityToken.incomingClientName === 'mark')
        done(new Error('Parsed capability token should have incoming client name "mark"'));
      else
        done();
    });
  });

  it('should parse outgoing capability tokens', function(done) {
    getCapabilityToken(null, 'AP123', null, done, function(capabilityToken) {
      if (!capabilityToken.supportsOutgoing)
        done(new Error('Parsed capability token should support outgoing'));
      else if (!capabilityToken.outgoingAppSid === 'AP123')
        done(new Error('Parsed capability token should have outgoing app SID "AP123"'));
      else
        done();
    });
  });

  it('should parse outgoing capability tokens with parameters', function(done) {
    getCapabilityToken(null, 'AP123', '%C4%A2irts=Graudi%C5%86%C5%A1', done, function(capabilityToken) {
      var parameters = capabilityToken.outgoingParameters;
      if (!('Ģirts' in parameters))
        done('Parsed capability token should include outgoing parameter "Ģirts"');
      else if (parameters['Ģirts'] !== 'Graudiņš')
        done("Parsed capability token's outgoing parameter \"Ģirts\" should equal \"Graudiņš\"");
      else
        done();
    });
  });

});

function getCapabilityToken(incomingClientName, outgoingAppSid, outgoingParameters, errorCallback, successCallback) {
  var capability = new twilio.Capability(ACCOUNT_SID, AUTH_TOKEN);
  if (incomingClientName)
    capability.allowClientIncoming(incomingClientName);
  if (outgoingAppSid) {
    if (outgoingParameters)
      capability.allowClientOutgoing(outgoingAppSid, util.fromURLFormEncoded(outgoingParameters));
    else
      capability.allowClientOutgoing(outgoingAppSid);
  }
  var capabilityTokenString = capability.generate();
  try {
    var capabilityToken = new CapabilityToken(capabilityTokenString);
  } catch (e) {
    return errorCallback(e);
  }
  successCallback(capabilityToken);
}

module.exports = {
  'getCapabilityToken': getCapabilityToken
}; 
