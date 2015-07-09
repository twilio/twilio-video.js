'use strict';

var assert = require('assert');
var Invite = require('lib/invite');
var MockDialog = require('test/mock/dialog');
var MockIST = require('test/mock/inviteServerTransaction');
var sinon = require('sinon');

describe('Invite', function() {
  var ist;
  var invite;
  var localMedia;

  this.timeout(50);

  beforeEach(function() {
    localMedia = Promise.resolve({ });
    ist = new MockIST();
    invite = new Invite(ist);
  });

  describe('constructor', function() {
    it('should return an instance of Invite if called as a method', function() {
      assert(Invite(ist) instanceof Invite);
    });
  });

  describe('#accept(options)', function() {
    it('should return a Promise for a Conversation', function(done) {
      invite.accept({ localMedia: localMedia }).then(function(conversation) {
        assert(conversation._dialogs.size);
      }).then(done, done);
      ist.accept.resolve(new MockDialog());
    });

    it('should not add a Dialog to the Conversation more than once', function(done) {
      invite.accept({ localMedia: localMedia }).then(function(conversation1) {
        invite.accept({ localMedia: localMedia }).then(function(conversation2) {
          assert.equal(conversation1._dialogs.size, 1);
        }).then(done, done);
      });

      ist.accept.resolve(new MockDialog());
    });

    it('should return a Promise for the existing Conversation if the IST is already accepted', function(done) {
      invite.accept({ localMedia: localMedia }).then(function(conversation1) {
        ist.isAccepted = true;
        invite.accept({ localMedia: localMedia }).then(function(conversation2) {
          assert.equal(conversation1, conversation2);
        }).then(done, done);
      });

      ist.accept.resolve(new MockDialog());
    });

    context('when it succeeds', function() {
      it('should emit accepted', function(done) {
        invite.on('accepted', function() { done(); });
        invite.accept({ localMedia: localMedia });
        ist.accept.resolve(new MockDialog());
      });
    });

    context('when it fails', function() {
      it('should emit failed', function(done) {
        invite.on('failed', function() { done(); });
        invite.accept({ localMedia: localMedia });
        ist.accept.reject();
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
