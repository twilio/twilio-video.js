'use strict';

var assert = require('assert');
var IncomingInvite = require('lib/incominginvite');
var MockDialog = require('test/mock/dialog');
var MockIST = require('test/mock/inviteservertransaction');
var sinon = require('sinon');
var util = require('lib/util');

describe('IncomingInvite', function() {
  var ist;
  var invite;
  var localMedia;

  beforeEach(function() {
    localMedia = Promise.resolve({ });
    ist = new MockIST();
    invite = new IncomingInvite(ist);
  });

  describe('constructor', function() {
    it('should return an instance of IncomingInvite if called as a method', function() {
      assert(IncomingInvite(ist) instanceof IncomingInvite);
    });
  });

  describe('#accept(options)', function() {
    it('should return a Promise for a Conversation', function(done) {
      invite.accept({ localMedia: localMedia }).then(function(conversation) {
        assert(conversation._dialogs.size);
      }).then(done, done);
      ist.accept.resolve(new MockDialog(util.makeURI('AC123', 'foo')));
    });

    it('should not add a Dialog to the Conversation more than once', function(done) {
      invite.accept({ localMedia: localMedia }).then(function(conversation1) {
        invite.accept({ localMedia: localMedia }).then(function(conversation2) {
          assert.equal(conversation1._dialogs.size, 1);
        }).then(done, done);
      });

      ist.accept.resolve(new MockDialog(util.makeURI('AC123', 'foo')));
    });

    it('should return a Promise for the existing Conversation if the IST is already accepted', function(done) {
      invite.accept({ localMedia: localMedia }).then(function(conversation1) {
        ist.isAccepted = true;
        invite.accept({ localMedia: localMedia }).then(function(conversation2) {
          assert.equal(conversation1, conversation2);
        }).then(done, done);
      });

      ist.accept.resolve(new MockDialog(util.makeURI('AC123', 'foo')));
    });

    context('when it succeeds', function() {
      it('should emit accepted', function(done) {
        invite.once('accepted', function() { done(); });
        invite.accept({ localMedia: localMedia });
        ist.accept.resolve(new MockDialog(util.makeURI('AC123', 'foo')));
      });
    });

    context('when it fails', function() {
      it('should emit failed', function(done) {
        invite.once('failed', function() { done(); });
        invite.accept({ localMedia: localMedia }).then(console.log.bind(console, 'what'), console.log.bind(console, 'happend'));
        try {
        ist.accept.reject();
        } catch (error) {
          console.log(error);
        }
      });
    });
  });

  describe('#reject', function() {
    it('should call its ISTs reject function', function() {
      invite.reject();
      sinon.assert.calledOnce(ist.reject);
    });
  });

  describe('events', function() {
    context('when canceled', function() {
      it('should emit #canceled', function(done) {
        invite.once('canceled', function() { done(); });
        ist.emit('canceled');
      });
    });
  });
});
