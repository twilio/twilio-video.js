'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');
var Conversation = require('lib/conversation');
var MockDialog = require('test/mock/dialog');
var sinon = require('sinon');
var util = require('lib/util');

var jwt = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1zYXQ7dj0xIn0.eyJleHAiOjE0NDM1NzU5NzQuODQ1MjQyLCJpc3MiOiJTSzllZGY5YWNiM2JkMjFmNTRjZTM0ODllMThjMDk2YmY5IiwibmJmIjoxNDQzNTc0MDU0Ljg0NTI0MiwiZ3JhbnRzIjpbeyJyZXMiOiJodHRwczovL2FwaS50d2lsaW8uY29tLzIwMTAtMDQtMDEvQWNjb3VudHMvQUM5NmNjYzkwNDc1M2IzMzY0ZjI0MjExZThkOTc0NmE5My9Ub2tlbnMuanNvbiIsImFjdCI6WyJQT1NUIl19LHsicmVzIjoic2lwOnlvQEFDOTZjY2M5MDQ3NTNiMzM2NGYyNDIxMWU4ZDk3NDZhOTMuZW5kcG9pbnQudHdpbGlvLmNvbSIsImFjdCI6WyJpbnZpdGUiLCJsaXN0ZW4iXX1dLCJzdWIiOiJBQzk2Y2NjOTA0NzUzYjMzNjRmMjQyMTFlOGQ5NzQ2YTkzIiwianRpIjoiU0s5ZWRmOWFjYjNiZDIxZjU0Y2UzNDg5ZTE4YzA5NmJmOWlxaEhmcG1yUUVLeGpBU0F3In0.d4eHbuTDQA499Zm1-SWjGWQ6zqQNnNv1iDI22Db7Umw';

describe('Conversation', function() {
  var conversation;
  var dialog;
  var dialog2;
  var token;

  beforeEach(function(done) {
    conversation = new Conversation();
    token = jwt;
    var accessManager = new AccessManager(token);
    dialog = new MockDialog(util.makeURI('AC123', 'foo'), accessManager);
    dialog2 = new MockDialog(util.makeURI('AC123', 'bar'), accessManager);
    conversation._onDialog(dialog);
    conversation._onDialog(dialog2);
    assert(dialog.userAgent.accessManager);

    // Make sure our addDialog events are done
    // firing before starting the test
    var count = 0;
    conversation.on('participantConnected', function() {
      if (++count === 2) { done(); }
    });
  });

  describe('new Conversation(options)', function() {
    it('should return an instance when called as a function', function() {
      assert(Conversation() instanceof Conversation);
    });
  });

  describe('#_onDialog(dialog)', function() {
    context('when dialog is new', function() {
      it('should add passed Dialog to Conversation._dialogs', function() {
        assert(conversation._dialogs.has(dialog));
      });

      it('should emit a participantConnected event and store that Participant', function(done) {
        var dialog3 = new MockDialog(util.makeURI('AC123', 'baz'));

        conversation.on('participantConnected', function(participant) {
          if (participant.identity === 'baz') {
            assert(conversation.participants.has(participant.sid));
            done();
          }
        });

        conversation._onDialog(dialog3);
      });
    });

    context('when dialog has already been added', function() {
      it('should fail silently and be chainable', function() {
        assert.equal(conversation._onDialog(dialog), conversation);
        assert.equal(conversation._dialogs.size, 2);
      });
    });
  });

  describe('#_removeDialog(dialog)', function() {

    it('should remove the Dialog from Conversation._dialogs', function() {
      conversation._removeDialog(dialog);
      assert.equal(conversation._dialogs.size, 1);
    });

    it('should emit a participantDisconnected event and remove that Participant', function(done) {
      conversation.once('participantDisconnected', function(participant) {
        assert(!conversation.participants.has(participant.sid));
        done();
      });
      conversation._removeDialog(dialog);
      conversation._removeDialog(dialog2);
    });

    it('should emit disconnected event when there are no Dialogs left', function(done) {
      conversation.on('disconnected', function() {
        assert.equal(conversation._dialogs.size, 0);
        done();
      });
      conversation._removeDialog(dialog);
      conversation._removeDialog(dialog2);
    });

    it('should remove any associate dialogs before emitting participantDisconnected', function(done) {
      conversation.once('participantDisconnected', function(participant) {
        assert(!conversation._dialogs.has(participant._dialog));
        done();
      });
      conversation._removeDialog(dialog);
      conversation._removeDialog(dialog2);
    });
  });

  describe('#getStats()', function() {
    it('should call #getStats of each Dialog', function() {
      conversation.getStats();
      sinon.assert.calledOnce(dialog.getStats);
      sinon.assert.calledOnce(dialog2.getStats);
    });

    it('should return a Promise<Array<Stats>>', function(done) {
      conversation.getStats().then(function(stats) {
        assert(stats.forEach);
        done();
      });
    });
  });

  describe('#disconnect()', function() {
    it('should call #end of each Dialog', function() {
      conversation.disconnect();
      sinon.assert.calledOnce(dialog.end);
      sinon.assert.calledOnce(dialog2.end);
    });

    it('should return the Conversation', function() {
      assert.equal(conversation, conversation.disconnect());
    });
  });

  describe('#invite(identity)', function() {
    it('should throw an error if identity is not provided', function() {
      assert.throws(conversation.invite);
    });
  });

  describe('#_invite(dialog, identity, timeout)', function() {
    it('should emit participantFailed if the call times out', function(done) {
      conversation.on('participantFailed', function(identity) {
        assert.equal(identity, 'foo');
        done();
      });

      conversation._invite(dialog, 1, 'foo');
    });

    it('should emit participantFailed if the refer fails', function(done) {
      conversation.on('participantFailed', function(identity) {
        assert.equal(identity, 'foo');
        done();
      });

      dialog.refer.rejectNext = true;
      conversation._invite(dialog, 100, 'foo');
    });

    it('should resolve if the participant connects', function(done) {
      conversation._invite(dialog, 1000, 'foo').then(function() {
        done();
      });
      conversation.emit('participantConnected', { identity: 'foo' });
    });

    it('should not resolve if a different participant connects', function(done) {
      var timeout = setTimeout(done, 10);

      conversation._invite(dialog, 100, 'foo').then(function() {
        assert.fail('Resolved when the wrong participant connected');
        clearTimeout(timeout);
      }).then(done);

      conversation.emit('participantConnected', { identity: 'bar' });
    });
  });

  describe('Participant events', function() {
    var participants;

    beforeEach(function() {
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
      conversation.participants.delete(participants['foo'].sid);

      var spy = new sinon.spy();
      conversation.on('trackAdded', spy);
      conversation.on('trackRemoved', spy);

      participants['foo'].emit('trackAdded');
      participants['foo'].emit('trackRemoved');
      assert.equal(spy.callCount, 0);
    });
  });

  describe('Dialog events', function() {
    it('should remove the dialog in response to dialog#ended', function() {
      dialog.emit('ended', dialog);
      assert(!conversation._dialogs.has(dialog));
    });
  });
});
