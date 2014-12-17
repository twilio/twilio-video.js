'use strict';

var assert = require('assert');

var _Endpoint = require('../../lib/endpoint');
var getToken = require('../token').getLiveToken;
var Log = require('../../lib/util/log');
var mockWebRTC = require('../mockwebrtc.js');
var Q = require('q');

mockWebRTC(global);

function Endpoint(token, options) {
  options = options || {};
  options['debug'] = false;
  // options['wsServer'] = 'ws://54.173.170.237:5082';
  options['register'] = false;
  options['registrarServer'] = 'twil.io';
  options['logLevel'] = Log.ERROR;
  return new _Endpoint(token, options);
}

describe('Endpoint', function() {
  this.timeout(30 * 1000); // 30 seconds

  var accountSid = process.env.ACCOUNT_SID;
  var authToken = process.env.AUTH_TOKEN;
  var address = 'alice';
  var apiHost = process.env.API_HOST;

  var token = null;
  var endpoint = null;

  before(function(done) {
    getToken(accountSid, authToken, address, apiHost)
      .done(function(_token) {
        token = _token;
        done();
      }, done);
  });

  beforeEach(function() {
    endpoint = new Endpoint(token);
  });

  it('constructor works', function() {
    assert.equal(address, endpoint.address);
    assert.equal(false, endpoint.online);
    assert.equal(true, endpoint.offline);
    closeWebSocket(endpoint);
  });

  it('#register works', function(done) {
    register(endpoint, function(error) {
      if (error) {
        closeWebSocket(endpoint);
        return done(error);
      }
      closeWebSocket(endpoint);
      done();
    });
  });

/*
  it('#unregister works', function(done) {
    register(endpoint, function(error) {
      if (error) {
        closeWebSocket(endpoint);
        return done(error);
      }
      unregister(endpoint, function(error) {
        if (error) {
          closeWebSocket(endpoint);
          return done(error);
        }
        closeWebSocket(endpoint);
        done();
      });
    });
  });
*/

  it('#createSession sends INVITE to another Endpoint', function(done) {
    getToken(accountSid, authToken, 'bob', apiHost).done(function(token2) {
      var endpoint2 = new Endpoint(token2);
      Q.all([endpoint.register(), endpoint2.register()]).done(
        function(endpoints) {
          var session = endpoint.createSession(endpoint2);
          session.then(function(session) {
            endpoint2.on('invite', function(_session) {
              try {
                assert.equal(session, _session);
              } catch (e) {
                closeWebSocket(endpoint);
                closeWebSocket(endpoint2);
                return done(e);
              }
              closeWebSocket(endpoint);
              closeWebSocket(endpoint2);
              done();
            });
          });
        }, done);
    }, done);
  });

/*
  it('#join works on Session raised by \'invite\'', function(done) {
    getToken(accountSid, authToken, 'bob', apiHost).done(function(token2) {
      var endpoint2 = new Endpoint(token2);
      Q.all([endpoint.register(), endpoint2.register()]).done(
        function(endpoints) {
          var session = endpoint.createSession(endpoint2);
          session.then(function(session) {
            endpoint2.on('invite', function(_session) {
              try {
                assert.equal(session, _session);
              } catch (e) {
                closeWebSocket(endpoint);
                closeWebSocket(endpoint2);
                return done(e);
              }
              endpoint2.join(_session);
              _session.once('participantJoined', function(participant) {
                closeWebSocket(endpoint);
                closeWebSocket(endpoint2);
                try {
                  assert.equal(endpoint2, participant);
                } catch (e) {
                  return done(e);
                }
                done();
              });
            });
          });
        }, done);
    }, done);
  });
*/

  function closeWebSocket(endpoint) {
    endpoint._userAgent._ua.stop();
  }

  function register(endpoint, done) {
    endpoint.register().done(function() {
      try {
        assert.equal(false, endpoint.offline);
        assert.equal(true, endpoint.online);
      } catch (e) {
        return done(e);
      }
      done();
    }, done);
  }

  function unregister(endpoint, done) {
    endpoint.unregister().done(function() {
      try {
        assert.equal(true, endpoint.offline);
        assert.equal(false, endpoint.online);
      } catch (e) {
        return done(e);
      }
      done();
    }, done);
  }

});
