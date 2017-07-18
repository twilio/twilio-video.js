'use strict';

var assert = require('assert');
var Room = require('../../../lib/room');
var RoomSignaling = require('../../../lib/signaling/room');
var ParticipantSignaling = require('../../../lib/signaling/participant');
var RemoteParticipantSignaling = require('../../../lib/signaling/remoteparticipant');
var SignalingConnectionDisconnectedError = require('../../../lib/util/twilio-video-errors').SignalingConnectionDisconnectedError;
var sinon = require('sinon');
var log = require('../../lib/fakelog');

describe('Room', function() {
  var room;
  var options = { log: log };
  var localParticipant = new ParticipantSignaling('PAXXX', 'client');
  var signaling;

  beforeEach(function() {
    signaling = new RoomSignaling(localParticipant, 'RM123', 'foo');
    room = new Room(localParticipant, signaling, options);
  });

  describe('new Room(signaling)', function() {
    it('should return an instance when called as a function', function() {
      assert(Room(localParticipant, signaling, options) instanceof Room);
    });
  });

  describe('#disconnect()', function() {
    it('should return the Room', function() {
      assert.equal(room, room.disconnect());
    });

    it('should trigger "disconnect" event on the Room with the Room as the argument', () => {
      var spy = sinon.spy();
      room.on('disconnected', spy);
      room.disconnect();
      assert.equal(spy.callCount, 1);
      assert.equal(spy.args[0][0], room);
    });
  });

  describe('RemoteParticipant events', function() {
    var participants;

    beforeEach(function() {
      [
        new RemoteParticipantSignaling('PA000', 'foo'),
        new RemoteParticipantSignaling('PA111', 'bar')
      ].forEach(signaling.connectParticipant.bind(signaling));
      participants = { };
      room.participants.forEach(function(participant) {
        participants[participant.identity] = participant;
      });
    });

    it('should re-emit RemoteParticipants trackAdded event for matching RemoteParticipant only', function() {
      var spy = new sinon.spy();
      room.on('trackAdded', spy);

      participants['foo'].emit('trackAdded');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipants trackRemoved event for matching RemoteParticipant only', function() {
      var spy = new sinon.spy();
      room.on('trackRemoved', spy);

      participants['bar'].emit('trackRemoved');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipants trackSubscribed event for matching RemoteParticipant only', function() {
      var spy = new sinon.spy();
      room.on('trackSubscribed', spy);

      participants['foo'].emit('trackSubscribed');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipants trackUnsubscribed event for matching RemoteParticipant only', function() {
      var spy = new sinon.spy();
      room.on('trackUnsubscribed', spy);

      participants['bar'].emit('trackUnsubscribed');
      assert.equal(spy.callCount, 1);
    });

    it('should not re-emit RemoteParticipant events if the RemoteParticipant is no longer in the room', function() {
      participants['foo'].emit('disconnected');

      var spy = new sinon.spy();
      room.on('trackAdded', spy);
      room.on('trackRemoved', spy);
      room.on('trackSubscribed', spy);
      room.on('trackUnsubscribed', spy);

      participants['foo'].emit('trackAdded');
      participants['foo'].emit('trackRemoved');
      participants['foo'].emit('trackSubscribed');
      participants['foo'].emit('trackUnsubscribed');
      assert.equal(spy.callCount, 0);
    });
  });

  describe('RoomSignaling state changed to "disconnected"', () => {
    context('when triggered due to unexpected connection loss', () => {
      it('should trigger the same event on the Room with itself and a SignalingConnectionDisconnectedError as the arguments', () => {
        var spy = sinon.spy();
        room.on('disconnected', spy);
        signaling.preempt('disconnected', null, [new SignalingConnectionDisconnectedError()]);
        assert.equal(spy.callCount, 1);
        assert.equal(spy.args[0][0], room);
        assert(spy.args[0][1] instanceof SignalingConnectionDisconnectedError);
        assert.equal(spy.args[0][1].code, 53001);
      });
    });

    it('should unsubscribe all the RemoteParticipants\' RemoteTracks', () => {
      [
        new RemoteParticipantSignaling('PA000', 'foo'),
        new RemoteParticipantSignaling('PA111', 'bar')
      ].forEach(signaling.connectParticipant.bind(signaling));

      var participants = {};
      room.participants.forEach(function(participant) {
        participant._removeAllSubscribedTracks = sinon.spy();
        participants[participant.identity] = participant;
      });
      signaling.preempt('disconnected');
      sinon.assert.calledOnce(participants['foo']._removeAllSubscribedTracks);
      sinon.assert.calledOnce(participants['bar']._removeAllSubscribedTracks);
    });
  });
});
