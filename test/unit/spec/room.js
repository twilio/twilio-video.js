'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');
var Room = require('../../../lib/room');
var RoomSignaling = require('../../../lib/signaling/room');
var LocalMedia = require('../../../lib/media/localmedia');
var Participant = require('../../../lib/participant');
var RemoteParticipantSignaling = require('../../../lib/signaling/remoteparticipant');
var sinon = require('sinon');
var util = require('../../../lib/util');

var token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1zYXQ7dj0xIn0.eyJleHAiOjE0NDM1NzU5NzQuODQ1MjQyLCJpc3MiOiJTSzllZGY5YWNiM2JkMjFmNTRjZTM0ODllMThjMDk2YmY5IiwibmJmIjoxNDQzNTc0MDU0Ljg0NTI0MiwiZ3JhbnRzIjpbeyJyZXMiOiJodHRwczovL2FwaS50d2lsaW8uY29tLzIwMTAtMDQtMDEvQWNjb3VudHMvQUM5NmNjYzkwNDc1M2IzMzY0ZjI0MjExZThkOTc0NmE5My9Ub2tlbnMuanNvbiIsImFjdCI6WyJQT1NUIl19LHsicmVzIjoic2lwOnlvQEFDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMuZW5kcG9pbnQudHdpbGlvLmNvbSIsImFjdCI6WyJpbnZpdGUiLCJsaXN0ZW4iXX1dLCJzdWIiOiJBQzk2Y2NjOTA0NzUzYjMzNjRmMjQyMTFlOGQ5NzQ2YTkzIiwianRpIjoiU0s5ZWRmOWFjYjNiZDIxZjU0Y2UzNDg5ZTE4YzA5NmJmOWlxaEhmcG1yUUVLeGpBU0F3In0.d4eHbuTDQA499Zm1-SWjGWQ6zqQNnNv1iDI22Db7Umw';

describe('Room', function() {
  var room;

  var localMedia = new LocalMedia();
  var localParticipant = new RemoteParticipantSignaling('PAXXX', 'client');
  var signaling = new RoomSignaling(localParticipant, 'RM123', localMedia);

  beforeEach(function() {
    room = new Room(localMedia, signaling);
  });

  describe('new Room(signaling)', function() {
    it('should return an instance when called as a function', function() {
      assert(Room(localMedia, signaling) instanceof Room);
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
