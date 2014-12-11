'use strict';

var assert = require('assert');

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

  before(function(done) {
    getToken(accountSid, authToken, address, apiHost)
      .done(function(_token) {
        token = _token;
        done();
      }, done);
  });

  it('constructor works', function() {
    var endpoint = new Endpoint(token);
    assert.equal(address, endpoint.address);
  });

  it('#createSession works inviting self', function() {
    var endpoint = new Endpoint(token);
    var session = endpoint.createSession(endpoint);
    assert(session instanceof Session);
    if (!session.participants.has(endpoint)) {
      throw new Error('Endpoint missing from Session');
    }
  });

  it('#createSession works inviting address', function() {
    var endpoint = new Endpoint(token);
    var session = endpoint.createSession('bob@twil.io');
    assert(session instanceof Session);
    var participantAddresses = getParticipantAddresses(session);
    if (!participantAddresses.has('bob@twil.io')) {
      throw new Error('Participant "bob@twil.io" missing from Session');
    }
  });

  it('#createSession works inviting addresses', function() {
    var endpoint = new Endpoint(token);
    var addresses = ['bob@twil.io', 'charles@twil.io'];
    var session = endpoint.createSession(addresses);
    assert(session instanceof Session);
    var participantAddresses = getParticipantAddresses(session);
    addresses.forEach(function(address) {
      if (!participantAddresses.has(address)) {
        throw new Error('Participant "' + address + '" missing from Session');
      }
    });
  });

  it('#createSession works inviting Participant', function() {
    var endpoint = new Endpoint(token);
    var participant = new Participant('bob@twil.io');
    var session = endpoint.createSession(participant);
    assert(session instanceof Session);
    if (!session.participants.has(participant)) {
      throw new Error('Participant "bob@twil.io" missing from Session');
    }
  });

  it('#createSession works inviting Participants', function() {
    var endpoint = new Endpoint(token);
    var participants = [
      new Participant('bob@twil.io'),
      new Participant('charles@twil.io')
    ];
    var session = endpoint.createSession(participants);
    assert(session instanceof Session);
    participants.forEach(function(participant) {
      if (!session.participants.has(participant)) {
        throw new Error('Participant "' + participant.address +
          '" missing from Session');
      }
    });
  });

  function getParticipantAddresses(session) {
    return session.participants.map(function(participant) {
      return participant.address;
    });
  }

});
