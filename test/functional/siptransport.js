'use strict';

var assert = require('assert');

var SIPTransportFactory = require('../../lib/siptransport').SIPTransportFactory;

var DEBUG = process.env.DEBUG === 'true';
var WS_SERVER = process.env.WS_SERVER;

var options = { 'debug': DEBUG, 'wsServer': WS_SERVER };
var peer1 = { name: 'peer1', uuid: '456' };
var peer2 = { name: 'peer2', uuid: '789' };
var transport1 = null;
var transport2 = null;
var transportFactory = null;

describe('SIPTransport', function() {

  beforeEach(function() {
    transportFactory = SIPTransportFactory.getInstance(options);
  });

  afterEach(function() {
    transportFactory.reset();
    transportFactory = null;
    transport1 = null;
    transport2 = null;
  });

  it('#addPeer works', function() {
    assert(!transportFactory.hasPeer(peer1));
    assert(!transportFactory.hasPeer(peer2));
    assert.equal(0, transportFactory.peers.length);
    assert.equal(0, transportFactory.transports.length);
    transport1 = transportFactory.addPeer(peer1);
    transport2 = transportFactory.addPeer(peer2);
    assert(transportFactory.hasPeer(peer1));
    assert(transportFactory.hasPeer(peer2));
    assert.equal(2, transportFactory.peers.length);
    assert.equal(2, transportFactory.transports.length);
  });

  it('#addPeer throws error if Peer added twice', function() {
    assert(!transportFactory.hasPeer(peer1));
    assert.equal(0, transportFactory.peers.length);
    assert.equal(0, transportFactory.transports.length);
    transport1 = transportFactory.addPeer(peer1);
    assert.throws(transportFactory.addPeer.bind(null, peer1));
    assert(transportFactory.hasPeer(peer1));
    assert.equal(1, transportFactory.peers.length);
    assert.equal(1, transportFactory.transports.length);
  });

  it('#removePeer works', function() {
    assert(!transportFactory.hasPeer(peer1));
    assert(!transportFactory.hasPeer(peer2));
    assert.equal(0, transportFactory.peers.length);
    assert.equal(0, transportFactory.transports.length);
    transport1 = transportFactory.addPeer(peer1);
    transport2 = transportFactory.addPeer(peer2);
    transportFactory.removePeer(peer1);
    transportFactory.removePeer(peer2);
    assert(!transportFactory.hasPeer(peer1));
    assert(!transportFactory.hasPeer(peer2));
    assert.equal(0, transportFactory.peers.length);
    assert.equal(0, transportFactory.transports.length);
  });

  it('#removePeer returns null for non-existant Peer', function() {
    assert.equal(null, transportFactory.removePeer(peer1));
  });

});
