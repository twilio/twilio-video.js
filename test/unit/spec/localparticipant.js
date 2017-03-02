'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var LocalParticipant = require('../../../lib/localparticipant');
var sinon = require('sinon');
var log = require('../../lib/fakelog');

describe('LocalParticipant', () => {
  describe('constructor', () => {
    context('when a room is joined', () => {
      it('should have the updated "identity" and "sid"', () => {
        // In makeTest(), test.signaling.sid and test.signaling.identity are
        // set to null, to mimic the ParticipantSignaling constructor
        var test = makeTest({ state: 'connecting' });
        // Spoofing a room joining event by populating the
        // "identity" and "sid" members of the signaling instance
        test.signaling.identity = 'newIdentity';
        test.signaling.sid = 'newSid';
        // Now, localParticipant should have the updated "identity" and "sid"
        assert.equal(test.signaling.sid, test.participant.sid);
        assert.equal(test.signaling.identity, test.participant.identity);
      });
    });
  });

  describe('LocalTrack events', () => {
    context('"trackAdded" event', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('calls .addTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connecting' });
          var track = { _signaling: {} };
          test.participant.emit('trackAdded', track);
          assert.equal(track._signaling, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .addTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          var track = { _signaling: {} };
          test.participant.emit('trackAdded', track);
          assert.equal(track._signaling, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .addTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'disconnected' });
          var track = { _signaling: {} };
          test.participant.emit('trackAdded', track);
          assert(!test.signaling.addTrack.calledOnce);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        it('does not call .addTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          test.signaling.emit('stateChanged', 'disconnected');
          var track = { _signaling: {} };
          test.participant.emit('trackAdded', track);
          assert(!test.signaling.addTrack.calledOnce);
        });
      });
    });

    context('"trackRemoved" event', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('calls .removeTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connecting' });
          var track = { _signaling: {} };
          test.participant.emit('trackRemoved', track);
          assert.equal(track._signaling, test.signaling.removeTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .removeTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          var track = { _signaling: {} };
          test.participant.emit('trackRemoved', track);
          assert.equal(track._signaling, test.signaling.removeTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .removeTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'disconnected' });
          var track = { _signaling: {} };
          test.participant.emit('trackRemoved', track);
          assert(!test.signaling.removeTrack.calledOnce);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        it('does not call .removeTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          test.signaling.emit('stateChanged', 'disconnected');
          var track = { _signaling: {} };
          test.participant.emit('trackRemoved', track);
          assert(!test.signaling.removeTrack.calledOnce);
        });
      });
    });

    context('.tracks', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('calls .addTrack with each LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track._signaling = {};
          var test = makeTest({
            state: 'connecting',
            tracks: [track]
          });
          assert.equal(track._signaling, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .addTrack with each LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track._signaling = {};
          var test = makeTest({
            state: 'connected',
            tracks: [track]
          });
          assert.equal(track._signaling, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .addTrack with each LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track._signaling = {};
          var test = makeTest({
            state: 'disconnected',
            tracks: [track]
          });
          assert(!test.signaling.addTrack.calledOnce);
        });
      });
    });
  });

  describe('ParticipantSignaling', () => {
    context('"stateChanged" event', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('re-emits "stateChanged" event states', () => {
          var test = makeTest({ state: 'connecting' });
          var stateChanged;
          test.participant.once('foo', participant => stateChanged = participant);
          test.signaling.emit('stateChanged', 'foo');
          assert.equal(
            test.participant,
            stateChanged);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('re-emits "stateChanged" event states', () => {
          var test = makeTest({ state: 'connected' });
          var stateChanged;
          test.participant.once('foo', participant => stateChanged = participant);
          test.signaling.emit('stateChanged', 'foo');
          assert.equal(
            test.participant,
            stateChanged);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not re-emit "stateChanged" event states', () => {
          var test = makeTest({ state: 'disconnected' });
          var stateChanged = false;
          test.participant.once('foo', () => stateChanged = true);
          test.signaling.emit('stateChanged', 'foo');
          assert(!stateChanged);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        it('does not re-emit "stateChanged" event states', () => {
          var test = makeTest({ state: 'connected' });
          test.signaling.emit('stateChanged', 'disconnected');
          var stateChanged = false;
          test.participant.once('foo', () => stateChanged = true);
          test.signaling.emit('stateChanged', 'foo');
          assert(!stateChanged);
        });
      });
    });
  });
});

function makeTest(options) {
  options = options || {};
  options.signaling = options.signaling || makeSignaling(options);
  options.tracks = options.tracks || [];
  options.log = log;
  options.participant = options.participant ||
    new LocalParticipant(options.signaling, options.tracks, { log: log });
  return options;
}

function makeSignaling(options) {
  var signaling = new EventEmitter();
  options = options || {};
  options.state = options.state || 'connecting';
  signaling.identity = options.identity || null;
  signaling.sid = options.sid || null;
  signaling.state = options.state;
  signaling.addTrack = sinon.spy(() => {});
  signaling.removeTrack = sinon.spy(() => {});
  return signaling;
}
