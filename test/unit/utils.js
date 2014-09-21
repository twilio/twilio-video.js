var assert = require('assert');

var util = require('../../lib/util');

describe('parseConnectTarget', function() {

  it('should parse TwiML app SIDs', function() {
    var appSID = 'APbf44e584f6698872d0fafbdb7e738c5f';
    var parsed = util.parseConnectTarget('twiml:' + appSID);
    assert.equal('twiml', parsed.type);
    assert.equal(appSID, parsed.target);
  });

  it('should parse client names', function() {
    var clientName = 'mroberts';
    var parsed = util.parseConnectTarget('client:' + clientName);
    assert.equal('client', parsed.type);
    assert.equal(clientName, parsed.target);
  });

  it('should parse SIP URIs', function() {
    var sipURI = 'monkey853@someone.sip.twilio.com';
    var parsed = util.parseConnectTarget('sip:' + sipURI);
    assert.equal('sip', parsed.type);
    assert.equal(sipURI, parsed.target);
  });

  it('should parse phone numbers', function() {
    var phoneNumber = '+14518675309';
    var parsed = util.parseConnectTarget('tel:' + phoneNumber);
    assert.equal('tel', parsed.type);
    assert.equal(phoneNumber, parsed.target);
  });

});
