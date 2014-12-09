'use strict';

global.WebSocket = require('ws');

var assert = require('assert');
var twilio = require('twilio');

var session = require('../../lib/session');
var IncomingSession = session.IncomingSession;
var OutgoingSession = session.OutgoingSession;
var Endpoint = require('../../lib/endpoint');
var SipUAFactory = require('../../lib/signaling/sip');

var ACCOUNT_SID = process.env.ACCOUNT_SID || 'AC123';
var API_HOST = process.env.API_HOST;
var APP_SID = process.env.APP_SID || 'AP123';
var AUTH_TOKEN = process.env.AUTH_TOKEN || 'xyz';
var DEBUG = process.env.DEBUG === 'true';
var WS_SERVER = process.env.WS_SERVER;

var options = { 'debug': DEBUG, 'wsServer': WS_SERVER };
var transportFactory = null;
var endpoint = null;

describe('Endpoint', function() {

  this.timeout(0);

  beforeEach(function() {
    transportFactory = SipUAFactory.getInstance(options);
    endpoint = new Endpoint();
  });

  afterEach(function() {
    transportFactory.reset();
    transportFactory = null;
  });

  it('constructor works', function() {
    // Tested in beforeEach.
  });

  it('#auth with invalid capability token throws error', function() {
    assert.throws(endpoint.auth.bind(endpoint, 'xyz'));
  });

  it('#auth with valid capability token works', function() {
    var token = makeOutgoingCapabilityToken();
    endpoint.auth(token);
    assert.equal(token, endpoint.capabilityToken.capabilityTokenString);
  });

  it('#auth with incoming capability token triggers REGISTER', function(done) {
    var token = makeIncomingCapabilityToken('foo');
    endpoint.auth(token);
    endpoint.once('registered', done);
    endpoint.once('error', done);
  });

  it('#call fails without outgoing capability', function() {
    assert.throws(endpoint.call.bind(endpoint, 'beta'));
    assert.equal(0, endpoint.sessions.length);
  });

  it('#call works with outgoing capability', function() {
    endpoint.auth(makeOutgoingCapabilityToken());
    var session = endpoint.call('beta');
    assert(session instanceof OutgoingSession);
    assert.equal(1, endpoint.sessions.length);
    session.cancel();
    assert.equal(0, endpoint.sessions.length);
  });

  it('"incoming" raised on incoming call', function(done) {
    var clientName = makeClientName(); 
    endpoint.auth(makeIncomingCapabilityToken(clientName));
    endpoint.once('error', done);

    // Once we've registered, trigger an outbound-api call and save its SID.
    var sessionsid = null;
    endpoint.once('registered', function() {
      var rest = new twilio.RestClient(ACCOUNT_SID, AUTH_TOKEN, { host: API_HOST });
      rest.makeSession({
        from: '+16024925066',
        to: 'client:' + clientName,
        ApplicationSid: APP_SID
      }, function(error, call) {
        if (error)
          return done(error);
        sessionsid = call.sid;
      });
    });

    // When "incoming" is raised, reject the call and compare its SID.
    endpoint.once('incoming', function(session) {
      try {
        assert(session instanceof IncomingSession);
        assert.equal(sessionsid, session.sid);
        session.reject();
        assert.equal(0, endpoint.sessions.length);
      } catch (error) {
        return done(error);
      }
      done();
    });
  });

  it('IncomingSession#accept updates .sessions', function(done) {
    var clientName = makeClientName();
    endpoint.auth(makeIncomingCapabilityToken(clientName));
    endpoint.once('error', done);

    // Once we've registered, trigger an outbound-api call and save its SID.
    var sessionsid = null;
    endpoint.once('registered', function() {
      var rest = new twilio.RestClient(ACCOUNT_SID, AUTH_TOKEN, { host: API_HOST });
      rest.makeSession({
        from: '+16024925066',
        to: 'client:' + clientName,
        ApplicationSid: APP_SID
      }, function(error, session) {
        if (error)
          return done(error);
        sessionsid = session.sid;
      });
    });

    // When "incoming" is raised, accept the call and compare its SID.
    endpoint.once('incoming', function(session) {
      try {
        assert(session instanceof IncomingSession);
        assert.equal(0, endpoint.sessions.length);
        assert.equal(sessionsid, session.sid);
        session.accept();
        assert.equal(1, endpoint.sessions.length);
        session.hangup();
        assert.equal(0, endpoint.sessions.length);
      } catch (error) {
        return done(error);
      }
      done();
    });
  });

});

function makeIncomingCapabilityToken(incomingClientName) {
  var capability = new twilio.Capability(ACCOUNT_SID, AUTH_TOKEN);
  capability.allowClientIncoming(incomingClientName);
  return capability.generate();
}

function makeOutgoingCapabilityToken(outgoingParameters) {
  var capability = new twilio.Capability(ACCOUNT_SID, AUTH_TOKEN);
  capability.allowClientOutgoing(APP_SID, outgoingParameters || null);
  return capability.generate();
}

function makeClientName(n) {
  n = n || 12;
  return (Math.random().toString(36)+'00000000000000000').slice(2, n+2)
}
