'use strict';

var assert = require('assert');

var _Endpoint = require('../../lib/endpoint');
var getToken = require('../token').getExpiredToken;
var Participant = require('../../lib/participant');
var Session = require('../../lib/session');
var UserAgent = require('../../lib/sip/useragent');

function Endpoint(token, options) {
  options = options || {};
  options['userAgent'] = UserAgent;
  return new _Endpoint(token, options);
}

describe('Session', function() {

  var accountSid = process.env.ACCOUNT_SID;
  var authToken = process.env.AUTH_TOKEN;
  var address = 'alice@twil.io';
  var apiHost = process.env.API_HOST;

  var token = null;
  var creator = null;
  var session = null;

  before(function(done) {
    getToken(accountSid, authToken, address, apiHost)
      .done(function(_token) {
        token = _token;
        done();
      }, done);
  });

  beforeEach(function() {
    creator = new Endpoint(token);
    session = new Session(creator);
  });

  afterEach(function() {
    Participant._reset();
    Session._reset();
  });

  it('constructor works', function() {
    // :-)
  });

});
