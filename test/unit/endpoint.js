'use strict';

var assert = require('assert');
var Q = require('q');

var Endpoint = require('../../lib/endpoint');
var getToken = require('../token');
var Participant = require('../../lib/participant');
var Session = require('../../lib/session');

describe('Endpoint', function() {

  var accountSid = process.env.ACCOUNT_SID;
  var authToken = process.env.AUTH_TOKEN;
  var address = 'alice@twil.io';
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
  });

  it('#createSession works inviting self', function() {
    var session = createSession(endpoint, endpoint);
    assert.equal(1, session.participants.size);
  });

  it('#createSession works inviting address', function() {
    var address = 'bob@twil.io';
    createSession(endpoint, address);
  });

  it('#createSession works inviting addresses', function() {
    var addresses = [
      'bob@twil.io',
      'charles@twil.io'
    ];
    createSession(endpoint, addresses);
  });

  it('#createSession works inviting Endpoint', function() {
    var endpoint2 = new Endpoint(token);
    createSession(endpoint, endpoint2);
  });

  it('#createSession works inviting Endpoints', function() {
    var endpoints = [
      new Endpoint(token),
      new Endpoint(token)
    ];
    createSession(endpoint, endpoints);
  });

  it('#createSession works inviting Participant', function() {
    var participant = new Participant('bob@twil.io');
    createSession(endpoint, participant);
  });

  it('#createSession works inviting Participants', function() {
    var participants = [
      new Participant('bob@twil.io'),
      new Participant('charles@twil.io')
    ];
    createSession(endpoint, participants);
  });

  it('#createSession works inviting addresses, Endpoints, & Participants',
    function() {
      var participants = [
        new Endpoint(token),
        'bob@twil.io',
        new Participant('charles@twil.io')
      ];
      var session = createSession(endpoint, participants);
      assert.equal(4, session.participants.size);
    }
  );

  it('#createSession works without participants', function() {
    var session = createSession(endpoint, []);
    assert.equal(1, session.participants.size);
  });

  function createSession(endpoint, participants) {
    var session = endpoint.createSession(participants);
    assert(session instanceof Session);
    sessionContainsParticipants(session, participants);
    return session;
  }

  function sessionContainsParticipants(session, participants) {
    var participants = session.participants;
    var participantAddresses = getParticipantAddresses(session);
    participants.forEach(function(participant) {
      var present;
      if (typeof participant === 'string') {
        present = participantAddresses.has(participant);
      } else {
        present = participants.has(participant);
      }
      if (!present) {
        throw new Error('Participant "' + participant.address +
          '" missing from Session');
      }
    });
  }

  function getParticipantAddresses(session) {
    return session.participants.map(function(participant) {
      return participant.address;
    });
  }

});
