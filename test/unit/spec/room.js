'use strict';

var assert = require('assert');
var Room = require('../../../lib/room');
var RoomSignaling = require('../../../lib/signaling/room');
var LocalMedia = require('../../../lib/media/localmedia');
var Participant = require('../../../lib/participant');
var RemoteParticipantSignaling = require('../../../lib/signaling/remoteparticipant');
var sinon = require('sinon');
var log = require('../../lib/fakelog');

describe('Room', function() {
  var room;
  var options = { log: log };
  var localMedia = new LocalMedia();
  var localParticipant = new RemoteParticipantSignaling('PAXXX', 'client');
  var signaling = new RoomSignaling(localParticipant, 'RM123', localMedia);

  beforeEach(function() {
    room = new Room(localMedia, signaling, options);
  });

  describe('new Room(signaling)', function() {
    it('should return an instance when called as a function', function() {
      assert(Room(localMedia, signaling, options) instanceof Room);
    });
  });

  describe('#disconnect()', function() {
    it('should return the Room', function() {
      assert.equal(room, room.disconnect());
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

    it('should re-emit Participants trackAdded event for matching Participant only', function() {
      var spy = new sinon.spy();
      room.on('trackAdded', spy);

      participants['foo'].emit('trackAdded');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit Participants trackRemoved event for matching Participant only', function() {
      var spy = new sinon.spy();
      room.on('trackRemoved', spy);

      participants['bar'].emit('trackRemoved');
      assert.equal(spy.callCount, 1);
    });

    it('should not re-emit Participant events if the Participant is no longer in the room', function() {
      participants['foo'].emit('disconnected');

      var spy = new sinon.spy();
      room.on('trackAdded', spy);
      room.on('trackRemoved', spy);

      participants['foo'].emit('trackAdded');
      participants['foo'].emit('trackRemoved');
      assert.equal(spy.callCount, 0);
    });
  });
});

function makeDummyLog() {
  var dummyLog = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };

  dummyLog.createLog = () => dummyLog;
  return dummyLog;
}
