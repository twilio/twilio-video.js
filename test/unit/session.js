'use strict';

var assert = require('assert');

var Endpoint = require('../../lib/endpoint');
var getToken = require('../token').getExpiredToken;
var Participant = require('../../lib/participant');
var Session = require('../../lib/session');

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

  it('constructor works', function() {
    // :-)
  });

});
