'use strict';

var assert = require('assert');
var C = require('lib/util/constants');
var Token = require('lib/accesstoken');

var config = require('../../../test.json');
var credentials = {
  accountSid: config.accountSid,
  signingKeySid: config.signingKeySid,
  signingKeySecret: config.signingKeySecret
};

var getToken = require('test/lib/token').getToken.bind(null, credentials);

describe('AccessToken', function() {
  describe('new AccessToken(jwt)', function() {
    it('should throw an error if the JWT string is invalid', function() {
      assert.throws(Token.bind(null, 'foobar'));
    });

    it('should correctly parse a JWT string (invite, listen)', function() {
      var name = randomName();
      var token = getToken({
        address: name,
        duration: 100,
        acts: ['invite', 'listen']
      });

      var token = new Token(token);

      assert.equal(token.accountSid, credentials.accountSid);
      assert.equal(token.address, name);
      assert.equal(token.host.match(/^(.*?)\.(.*)$/)[2], 'endpoint.twilio.com');
      assert.equal(token.signingKeySid, credentials.signingKeySid);
      assert.equal(token.canInvite, true);
      assert.equal(token.canListen, true);
      assert(token.expires instanceof Date);
    });

    it('should correctly parse a JWT string (no acts)', function() {
      var name = randomName();
      var token = getToken({
        address: name,
        duration: 100,
        acts: []
      });

      var token = new Token(token);

      assert.equal(token.accountSid, credentials.accountSid);
      assert.equal(token.address, name);
      assert.equal(token.host.match(/^(.*?)\.(.*)$/)[2], 'endpoint.twilio.com');
      assert.equal(token.signingKeySid, credentials.signingKeySid);
      assert.equal(token.canInvite, false);
      assert.equal(token.canListen, false);
      assert(token.expires instanceof Date);
    });

    it('should correctly parse a JWT string (no grants)', function() {
      var name = randomName();
      var token = getToken({
        address: name,
        duration: 100,
        emptyGrants: true,
        acts: []
      });

      var token = new Token(token);

      assert.equal(token.accountSid, credentials.accountSid);
      assert.equal(token.address, null);
      assert.equal(token.host, null);
      assert.equal(token.signingKeySid, credentials.signingKeySid);
      assert.equal(token.canInvite, false);
      assert.equal(token.canListen, false);
      assert(token.expires instanceof Date);
    });

    it('should correctly parse a JWT string (no sip resource)', function() {
      var name = randomName();
      var token = getToken();

      var token = new Token(token);

      assert.equal(token.accountSid, credentials.accountSid);
      assert(!token.address);
      assert(!token.host);
      assert.equal(token.signingKeySid, credentials.signingKeySid);
      assert.equal(token.canInvite, false);
      assert.equal(token.canListen, false);
      assert(token.expires instanceof Date);
    });

    it('should throw an error if SIP address is too long', function() {
      var longName = '';
      for(var i = 0; i <= C.MAX_ADDRESS_LENGTH; i++) { longName += 'A'; }
      assert.throws(function() {
        new Token(getToken({ address: longName }));
      });
    });
  });

  describe('.isExpired', function() {
    var accessToken;

    beforeEach(function() {
      var jwt = getToken({ address: 'foo', duration: 5 });
      accessToken = new Token(jwt);
    });

    it('should be true if the expiration date has passed', function(done) {
      setTimeout(function() {
        assert.equal(accessToken.isExpired, true);
        done();
      }, 10);
    });

    it('should be false if the expiration date has not passed', function() {
      assert.equal(accessToken.isExpired, false);
    });
  });

  describe('_validateAddress', function() {
    var jwt, token, hostLength;

    beforeEach(function() {
      jwt = getToken({ address: 'foo' });
      token = new Token(jwt);
      hostLength = (token.host + '@').length;
    });

    it('should throw an error if the full address length exceeds character limit', function() {
      var longName = '';
      for(var i = 0; i <= C.MAX_ADDRESS_LENGTH - hostLength; i++) { longName += 'A'; }
      assert.throws(token._validateAddress.bind(token, longName));
    });

    it('should throw an error if any full address length exceeds character limit', function() {
      var longName = '';
      for(var i = 0; i <= C.MAX_ADDRESS_LENGTH - hostLength; i++) { longName += 'A'; }
      assert.throws(token._validateAddress.bind(token, ['abc', longName]));
    });

    it('should not throw an error if addresses are within the character limit', function() {
      var validName = '';
      for(var i = 0; i < C.MAX_ADDRESS_LENGTH - hostLength; i++) { validName += 'A'; }
      token._validateAddress(['abc', validName]);
    });
  });

  describe('events', function() {
    it('should emit "expired" when the AccessToken expires', function(done) {
      var jwt = getToken({ address: 'foo', duration: 10 });
      var accessToken = new Token(jwt);

      accessToken.on('expired', function(token) {
        assert.equal(token, accessToken);
        done();
      });
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
