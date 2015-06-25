'use strict';

var assert = require('assert');
var Conversation = require('lib/conversation');
var MockDialog = require('test/mock/dialog');
var sinon = require('sinon');

describe('Conversation', function() {
  var conversation;
  var dialog;
  var dialog2;

  this.timeout(50);

  beforeEach(function(done) {
    conversation = new Conversation();
    dialog = new MockDialog('foo');
    dialog2 = new MockDialog('bar');
    conversation._addDialog(dialog);
    conversation._addDialog(dialog2);

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

  describe('#_addDialog(dialog)', function() {
    context('when dialog is new', function() {
      it('should add passed Dialog to Conversation._dialogs', function() {
        assert(conversation._dialogs.has(dialog));
      });

      it('should emit a participantConnected event and store that Participant', function(done) {
        var dialog3 = new MockDialog('baz');

        conversation.on('participantConnected', function(participant) {
          if (participant.address === 'baz') {
            assert(conversation.participants.has(participant));
            done();
          }
        });

        conversation._addDialog(dialog3);
      });
    });

    context('when dialog has already been added', function() {
      it('should fail silently and be chainable', function() {
        assert.equal(conversation._addDialog(dialog), conversation);
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
      conversation.on('participantDisconnected', function(participant) {
        assert(!conversation.participants.has(participant));
        done();
      });
      conversation._removeDialog(dialog);
    });

    it('should emit ended event when there are no Dialogs left', function(done) {
      conversation.on('ended', function() {
        assert.equal(conversation._dialogs.size, 0);
        done();
      });
      conversation._removeDialog(dialog);
      conversation._removeDialog(dialog2);
    });

    it('should remove any associate dialogs before emitting participantDisconnected', function(done) {
      conversation.on('participantDisconnected', function(participant) {
        assert(!conversation._dialogs.has(participant._dialog));
        done();
      });
      conversation._removeDialog(dialog);
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

    it('should return Promise<Conversation>', function(done) {
      conversation.disconnect().then(function(c) {
        assert.equal(c, conversation);
        done();
      });
    });
  });

  describe('#invite(participantAddress)', function() {
    it('should throw an error if participantAddress is not provided', function() {
      assert.throws(conversation.invite);
    });

    it('should return an array if it receives an array', function() {
      assert(conversation.invite(['foo']).forEach);
      assert(conversation.invite(['foo', 'bar']).forEach);
    });

    it('should not return an array if it receives a string', function() {
      assert(!conversation.invite('bar').forEach);
    });
  });

  describe('#_invite(dialog, participantAddress, timeout)', function() {
    it('should emit participantFailed if the call times out', function(done) {
      conversation.on('participantFailed', function(address) {
        assert.equal(address, 'foo');
        done();
      });

      conversation._invite(dialog, 1, 'foo');
    });

    it('should emit participantFailed if the refer fails', function(done) {
      conversation.on('participantFailed', function(address) {
        assert.equal(address, 'foo');
        done();
      });

      dialog.refer.rejectNext = true;
      conversation._invite(dialog, 100, 'foo');
    });

    it('should resolve if the participant connects', function(done) {
      conversation._invite(dialog, 1000, 'foo').then(function() {
        done();
      });
      conversation.emit('participantConnected', { address: 'foo' });
    });

    it('should not resolve if a different participant connects', function(done) {
      var timeout = setTimeout(done, 10);

      conversation._invite(dialog, 100, 'foo').then(function() {
        assert.fail('Resolved when the wrong participant connected');
        clearTimeout(timeout);
      }).then(done);

      conversation.emit('participantConnected', { address: 'bar' });
    });
  });

  describe('Participant events', function() {
    var participants;

    beforeEach(function() {
      participants = { };
      conversation.participants.forEach(function(participant) {
        participants[participant.address] = participant;
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
      conversation.participants.delete(participants['foo']);

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
      dialog.emit('ended');
      assert(!conversation._dialogs.has(dialog));
    });
  });
});
