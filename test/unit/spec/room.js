'use strict';

var assert = require('assert');
var Room = require('../../../lib/room');
var RoomSignaling = require('../../../lib/signaling/room');
var RemoteParticipantSignaling = require('../../../lib/signaling/remoteparticipant');
var SignalingConnectionDisconnectedError = require('../../../lib/util/twilio-video-errors').SignalingConnectionDisconnectedError;
var sinon = require('sinon');
var log = require('../../lib/fakelog');

describe('Room', function() {
  var room;
  var options = { log: log };
  var localParticipant = new RemoteParticipantSignaling('PAXXX', 'client');
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

  describe('Participant events', function() {
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

    it('should re-emit Participants trackAdded event for matching RemoteParticipant only', function() {
      var spy = new sinon.spy();
      room.on('trackAdded', spy);

      participants['foo'].emit('trackAdded');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit Participants trackRemoved event for matching RemoteParticipant only', function() {
      var spy = new sinon.spy();
      room.on('trackRemoved', spy);

      participants['bar'].emit('trackRemoved');
      assert.equal(spy.callCount, 1);
    });

    it('should not re-emit Participant events if the RemoteParticipant is no longer in the room', function() {
      participants['foo'].emit('disconnected');

      var spy = new sinon.spy();
      room.on('trackAdded', spy);
      room.on('trackRemoved', spy);

      participants['foo'].emit('trackAdded');
      participants['foo'].emit('trackRemoved');
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
  });
});
