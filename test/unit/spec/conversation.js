'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');
var Conversation = require('../../../lib/conversation');
var ConversationImpl = require('../../../lib/signaling/conversationimpl');
var MockDialog = require('../../mock/signaling/v1/dialog');
var Participant = require('../../../lib/participant');
var ParticipantImpl = require('../../../lib/signaling/participantimpl');
var sinon = require('sinon');
var util = require('../../../lib/util');

var token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1zYXQ7dj0xIn0.eyJleHAiOjE0NDM1NzU5NzQuODQ1MjQyLCJpc3MiOiJTSzllZGY5YWNiM2JkMjFmNTRjZTM0ODllMThjMDk2YmY5IiwibmJmIjoxNDQzNTc0MDU0Ljg0NTI0MiwiZ3JhbnRzIjpbeyJyZXMiOiJodHRwczovL2FwaS50d2lsaW8uY29tLzIwMTAtMDQtMDEvQWNjb3VudHMvQUM5NmNjYzkwNDc1M2IzMzY0ZjI0MjExZThkOTc0NmE5My9Ub2tlbnMuanNvbiIsImFjdCI6WyJQT1NUIl19LHsicmVzIjoic2lwOnlvQEFDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMuZW5kcG9pbnQudHdpbGlvLmNvbSIsImFjdCI6WyJpbnZpdGUiLCJsaXN0ZW4iXX1dLCJzdWIiOiJBQzk2Y2NjOTA0NzUzYjMzNjRmMjQyMTFlOGQ5NzQ2YTkzIiwianRpIjoiU0s5ZWRmOWFjYjNiZDIxZjU0Y2UzNDg5ZTE4YzA5NmJmOWlxaEhmcG1yUUVLeGpBU0F3In0.d4eHbuTDQA499Zm1-SWjGWQ6zqQNnNv1iDI22Db7Umw';

describe('Conversation', function() {
  var conversation;
  var dialog;
  var dialog2;

  var localMedia = {};
  var conversationImpl = new ConversationImpl('CV123', 'PA456', localMedia);

  beforeEach(function() {
    conversation = new Conversation(conversationImpl);
  });

  describe('new Conversation(impl)', function() {
    it('should return an instance when called as a function', function() {
      assert(Conversation(conversationImpl) instanceof Conversation);
    });
  });

  describe('#disconnect()', function() {
    it('should return the Conversation', function() {
      assert.equal(conversation, conversation.disconnect());
    });
  });

  describe('#invite(identity)', function() {
    it('should throw an error if identity is not provided', function() {
      assert.throws(conversation.invite);
    });
  });

  describe('Participant events', function() {
    var participants;

    beforeEach(function() {
      [
        new ParticipantImpl('PA000', 'foo', 'connected'),
        new ParticipantImpl('PA111', 'bar', 'connected')
      ].forEach(conversationImpl.emit.bind(conversationImpl,
        'participantConnected'));
      participants = { };
      conversation.participants.forEach(function(participant) {
        participants[participant.identity] = participant;
      });
    });

    it('should re-emit Participants trackAdded event for matching Participant only', function() {
      var spy = new sinon.spy();
      conversation.on('trackAdded', spy);

      participants['foo'].emit('trackAdded');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit Participants trackRemoved event for matching Participant only', function() {
      var spy = new sinon.spy();
      conversation.on('trackRemoved', spy);

      participants['bar'].emit('trackRemoved');
      assert.equal(spy.callCount, 1);
    });

    it('should not re-emit Participant events if the Participant is no longer in the conversation', function() {
      participants['foo'].emit('disconnected');

      var spy = new sinon.spy();
      conversation.on('trackAdded', spy);
      conversation.on('trackRemoved', spy);

      participants['foo'].emit('trackAdded');
      participants['foo'].emit('trackRemoved');
      assert.equal(spy.callCount, 0);
    });
  });
});
