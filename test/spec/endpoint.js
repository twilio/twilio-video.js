'use strict';

var assert = require('assert');

var Endpoint = typeof Twilio === 'undefined'
             ? require('../../lib/endpoint')
             : Twilio.Endpoint;

var getToken = typeof Twilio === 'undefined'
             ? require('../token').getLiveToken
             : require('../token').getBrowserToken;

var Q = require('q');

describe('Endpoint', function() {
  this.timeout(120 * 1000); // 30 seconds
  this.bail();

  var accountSid = process.env['ACCOUNT_SID'];
  var authToken = process.env['AUTH_TOKEN'];

  function createEndpoint(name) {
    return getToken(accountSid, authToken, name)
      .then(function(token) {
        return new Endpoint(token, {
          register: false,
          debug: false,
          logLevel: 3
        });
      });
  }

  var aliceName = Math.random().toString(36).slice(2);
  var bobName = Math.random().toString(36).slice(2);

  var alice = null;
  var bob = null;

  var session = null;

  it('construct a new Endpoint, Alice (' + aliceName + ')', function(done) {
    createEndpoint(aliceName)
      .then(function(endpoint) {
        alice = endpoint;
        try {
          assert.equal(aliceName, alice.address);
        } catch (e) {
          return done(e);
        }
        done();
      }, done);
  });

  it('Alice registers', function(done) {
    alice.register()
      .then(function() {
        try {
          assert.equal(aliceName, alice.address);
          assert.equal(true, alice.online);
          assert.equal(false, alice.offline);
        } catch (e) {
          return done(e);
        }
        done();
      }, done);
  });

  it('Alice unregisters', function(done) {
    alice.unregister()
      .then(function() {
        try {
          assert.equal(false, alice.online);
          assert.equal(true, alice.offline);
        } catch (e) {
          return done(e);
        }
        done();
      }, done);
  });

  it('Alice re-registers', function(done) {
    alice.register()
      .then(function() {
        try {
          assert.equal(true, alice.online);
          assert.equal(false, alice.offline);
        } catch (e) {
          return done(e);
        }
        done();
      }, done);
  });

  it('construct a new Endpoint, Bob (' + bobName + ')', function(done) {
    createEndpoint(bobName)
      .then(function(endpoint) {
        bob = endpoint;
        return bob.register();
      }).then(function() {
        try {
          assert.equal(bobName, bob.address);
          assert.equal(true, bob.online);
          assert.equal(false, bob.offline);
        } catch (e) {
          return done(e);
        }
        done();
      }, done);
  });

  it('Alice creates a Session with Bob; Bob receives "invite" event; Bob joins Session', function(done) {
    var aliceCreatedSession = Q.defer();
    var bobReceivedInvite = Q.defer();
    var bobJoinedSession = Q.defer();

    alice.createSession(bob)
      .then(function(_session) {
        session = _session;
        aliceCreatedSession.resolve();
      }, function(error) {
        aliceCreatedSession.reject(error)
      });

    bob.on('invite', function(_session, participant) {
      try {
        // FIXME(mroberts): These should be the same.
        // assert.equal(session, _session);
        // assert.equal(alice, participant);
      } catch (e) {
        return bobReceivedInvite.reject(e);
      }
      bobReceivedInvite.resolve();
      bob.join(_session)
        .then(function() {
          bobJoinedSession.resolve();
        }, function(error) {
          bobJoinedSession.reject(error); 
        });
    });

    Q.all([
      aliceCreatedSession.promise,
      bobReceivedInvite.promise,
      bobJoinedSession.promise
    ]).then(function() {
      done();
    }, done);
  });

  /*it('Alice leaves Session; Bob receives "participantLeft" event', function(done) {
    var aliceLeaves = Q.defer();
    var bobReceivesEvent = Q.defer();

    alice.leave(session)
      .then(function() {
        aliceLeaves.resolve()
      }, function(error) {
        aliceLeaves.reject(error);
      });

    session.once('participantLeft', function(participant) {
      bobReceivesEvent.resolve();
    });

    Q.all([aliceLeaves.promise, bobReceivesEvent.promise])
      .then(function() {
        done();
      }, done);
  });*/

  /*it('Bob leaves Session; Alice receives "participantLeft" event', function(done) {
    console.log(session);
    session.participants.forEach(function(participant) {
      console.log('- ' + participant.address);
    });
    console.log('\n\n~~~\n\n');

    var bobLeaves = Q.defer();
    var aliceReceivesEvent = Q.defer();

    bob.leave(session)
      .then(function() {
        bobLeaves.resolve()
      }, function(error) {
        bobLeaves.reject(error);
      });

    session.once('participantLeft', function(participant) {
      aliceReceivesEvent.resolve();
    });

    Q.all([bobLeaves.promise, aliceReceivesEvent.promise])
      .then(function() {
        done();
      }, done);
  });*/

});
