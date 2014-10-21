'use strict';

global.WebSocket = require('ws');

var assert = require('assert');
var twilio = require('twilio');

var IncomingCall = require('../../lib/incomingcall');
var OutgoingCall = require('../../lib/outgoingcall');
var Peer = require('../../lib/peer2');
var SIPTransportFactory = require('../../lib/siptransport').SIPTransportFactory;

var ACCOUNT_SID = process.env.ACCOUNT_SID || 'AC123';
var API_HOST = process.env.API_HOST;
var APP_SID = process.env.APP_SID || 'AP123';
var AUTH_TOKEN = process.env.AUTH_TOKEN || 'xyz';
var DEBUG = process.env.DEBUG === 'true';
var WS_SERVER = process.env.WS_SERVER;

var options = { 'debug': DEBUG, 'wsServer': WS_SERVER };
var transportFactory = null;
var peer = null;

describe('Peer', function() {

  this.timeout(0);

  beforeEach(function() {
    transportFactory = SIPTransportFactory.getInstance(options);
    peer = new Peer();
  });

  afterEach(function() {
    transportFactory.reset();
    transportFactory = null;
  });

  it('constructor works', function() {
    // Tested in beforeEach.
  });

  it('#auth with invalid capability token throws error', function() {
    assert.throws(peer.auth.bind(peer, 'xyz'));
  });

  it('#auth with valid capability token works', function() {
    var token = makeOutgoingCapabilityToken();
    peer.auth(token);
    assert.equal(token, peer.capabilityToken.capabilityTokenString);
  });

  it('#auth with incoming capability token triggers REGISTER', function(done) {
    var token = makeIncomingCapabilityToken('foo');
    peer.auth(token);
    peer.once('registered', done);
    peer.once('error', done);
  });

  it('#call fails without outgoing capability', function() {
    assert.throws(peer.call.bind(peer, 'beta'));
    assert.equal(0, peer.calls.length);
  });

  it('#call works with outgoing capability', function() {
    peer.auth(makeOutgoingCapabilityToken());
    var call = peer.call('beta');
    assert(call instanceof OutgoingCall);
    assert.equal(1, peer.calls.length);
    call.cancel();
    assert.equal(0, peer.calls.length);
  });

  it('"incoming" raised on incoming call', function(done) {
    var clientName = makeClientName(); 
    peer.auth(makeIncomingCapabilityToken(clientName));
    peer.once('error', done);

    // Once we've registered, trigger an outbound-api call and save its SID.
    var callSid = null;
    peer.once('registered', function() {
      var rest = new twilio.RestClient(ACCOUNT_SID, AUTH_TOKEN, { host: API_HOST });
      rest.makeCall({
        from: '+16024925066',
        to: 'client:' + clientName,
        ApplicationSid: APP_SID
      }, function(error, call) {
        if (error)
          return done(error);
        callSid = call.sid;
      });
    });

    // When "incoming" is raised, reject the call and compare its SID.
    peer.once('incoming', function(call) {
      try {
        assert(call instanceof IncomingCall);
        assert.equal(callSid, call.sid);
        call.reject();
        assert.equal(0, peer.calls.length);
      } catch (error) {
        return done(error);
      }
      done();
    });
  });

  it('IncomingCall#accept updates .calls', function(done) {
    var clientName = makeClientName();
    peer.auth(makeIncomingCapabilityToken(clientName));
    peer.once('error', done);

    // Once we've registered, trigger an outbound-api call and save its SID.
    var callSid = null;
    peer.once('registered', function() {
      var rest = new twilio.RestClient(ACCOUNT_SID, AUTH_TOKEN, { host: API_HOST });
      rest.makeCall({
        from: '+16024925066',
        to: 'client:' + clientName,
        ApplicationSid: APP_SID
      }, function(error, call) {
        if (error)
          return done(error);
        callSid = call.sid;
      });
    });

    // When "incoming" is raised, accept the call and compare its SID.
    peer.once('incoming', function(call) {
      try {
        assert(call instanceof IncomingCall);
        assert.equal(0, peer.calls.length);
        assert.equal(callSid, call.sid);
        call.accept();
        assert.equal(1, peer.calls.length);
        call.hangup();
        assert.equal(0, peer.calls.length);
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
