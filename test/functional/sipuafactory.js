'use strict';

var assert = require('assert');

var SipUAFactory = require('../../lib/signaling/sip');

var DEBUG = process.env.DEBUG === 'true';
var WS_SERVER = process.env.WS_SERVER;

var options = { 'debug': DEBUG, 'wsServer': WS_SERVER };
var endpoint1 = { name: 'endpoint1', uuid: '456' };
var endpoint2 = { name: 'endpoint2', uuid: '789' };
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

  it('#addEndpoint works', function() {
    assert(!sipUAFactory.hasEndpoint(endpoint1));
    assert(!sipUAFactory.hasEndpoint(endpoint2));
    assert.equal(0, sipUAFactory.endpoints.length);
    assert.equal(0, sipUAFactory.uas.length);
    sipua1 = sipUAFactory.addEndpoint(endpoint1);
    sipua2 = sipUAFactory.addEndpoint(endpoint2);
    assert(sipUAFactory.hasEndpoint(endpoint1));
    assert(sipUAFactory.hasEndpoint(endpoint2));
    assert.equal(2, sipUAFactory.endpoints.length);
    assert.equal(2, sipUAFactory.uas.length);
  });

  it('#addEndpoint throws error if Endpoint added twice', function() {
    assert(!sipUAFactory.hasEndpoint(endpoint1));
    assert.equal(0, sipUAFactory.endpoints.length);
    assert.equal(0, sipUAFactory.uas.length);
    sipua1 = sipUAFactory.addEndpoint(endpoint1);
    assert.throws(sipUAFactory.addEndpoint.bind(null, endpoint1));
    assert(sipUAFactory.hasEndpoint(endpoint1));
    assert.equal(1, sipUAFactory.endpoints.length);
    assert.equal(1, sipUAFactory.uas.length);
  });

  it('#removeEndpoint works', function() {
    assert(!sipUAFactory.hasEndpoint(endpoint1));
    assert(!sipUAFactory.hasEndpoint(endpoint2));
    assert.equal(0, sipUAFactory.endpoints.length);
    assert.equal(0, sipUAFactory.uas.length);
    sipua1 = sipUAFactory.addEndpoint(endpoint1);
    sipua2 = sipUAFactory.addEndpoint(endpoint2);
    sipUAFactory.removeEndpoint(endpoint1);
    sipUAFactory.removeEndpoint(endpoint2);
    assert(!sipUAFactory.hasEndpoint(endpoint1));
    assert(!sipUAFactory.hasEndpoint(endpoint2));
    assert.equal(0, sipUAFactory.endpoints.length);
    assert.equal(0, sipUAFactory.uas.length);
  });

  it('#removeEndpoint returns null for non-existant Endpoint', function() {
    assert.equal(null, sipUAFactory.removeEndpoint(endpoint1));
  });

});
