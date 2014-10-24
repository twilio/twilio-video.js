'use strict';

var assert = require('assert');

var SipUAFactory = require('../../lib/signaling/sip');

var DEBUG = process.env.DEBUG === 'true';
var WS_SERVER = process.env.WS_SERVER;

var options = { 'debug': DEBUG, 'wsServer': WS_SERVER };
var peer1 = { name: 'peer1', uuid: '456' };
var peer2 = { name: 'peer2', uuid: '789' };
var sipua1 = null;
var sipua2 = null;
var sipUAFactory = null;

describe('SipUAFactory', function() {

  beforeEach(function() {
    sipUAFactory = SipUAFactory.getInstance(options);
  });

  afterEach(function() {
    sipUAFactory.reset();
    sipUAFactory = null;
    sipua1 = null;
    sipua2 = null;
  });

  it('#addPeer works', function() {
    assert(!sipUAFactory.hasPeer(peer1));
    assert(!sipUAFactory.hasPeer(peer2));
    assert.equal(0, sipUAFactory.peers.length);
    assert.equal(0, sipUAFactory.uas.length);
    sipua1 = sipUAFactory.addPeer(peer1);
    sipua2 = sipUAFactory.addPeer(peer2);
    assert(sipUAFactory.hasPeer(peer1));
    assert(sipUAFactory.hasPeer(peer2));
    assert.equal(2, sipUAFactory.peers.length);
    assert.equal(2, sipUAFactory.uas.length);
  });

  it('#addPeer throws error if Peer added twice', function() {
    assert(!sipUAFactory.hasPeer(peer1));
    assert.equal(0, sipUAFactory.peers.length);
    assert.equal(0, sipUAFactory.uas.length);
    sipua1 = sipUAFactory.addPeer(peer1);
    assert.throws(sipUAFactory.addPeer.bind(null, peer1));
    assert(sipUAFactory.hasPeer(peer1));
    assert.equal(1, sipUAFactory.peers.length);
    assert.equal(1, sipUAFactory.uas.length);
  });

  it('#removePeer works', function() {
    assert(!sipUAFactory.hasPeer(peer1));
    assert(!sipUAFactory.hasPeer(peer2));
    assert.equal(0, sipUAFactory.peers.length);
    assert.equal(0, sipUAFactory.uas.length);
    sipua1 = sipUAFactory.addPeer(peer1);
    sipua2 = sipUAFactory.addPeer(peer2);
    sipUAFactory.removePeer(peer1);
    sipUAFactory.removePeer(peer2);
    assert(!sipUAFactory.hasPeer(peer1));
    assert(!sipUAFactory.hasPeer(peer2));
    assert.equal(0, sipUAFactory.peers.length);
    assert.equal(0, sipUAFactory.uas.length);
  });

  it('#removePeer returns null for non-existant Peer', function() {
    assert.equal(null, sipUAFactory.removePeer(peer1));
  });

});
