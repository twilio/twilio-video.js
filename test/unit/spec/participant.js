'use strict';

var assert = require('assert');
var MockDialog = require('test/mock/dialog');
var Participant = require('lib/participant');

describe('Participant', function() {
  var dialog;
  var participant;

  this.timeout(200);

  beforeEach(function() {
    dialog = new MockDialog('foo');
    participant = new Participant(dialog);
  });

  describe('new Participant(dialog)', function() {
    it('should return an instance when called as a function', function() {
      assert(Participant(dialog) instanceof Participant);
    });
  });

  describe('events', function() {
    it('should re-emit trackAdded from media', function(done) {
      participant.on('trackAdded', function() {
        done();
      });

      participant.media.emit('trackAdded');
    });

    it('should re-emit trackRemoved from media', function(done) {
      participant.on('trackRemoved', function() {
        done();
      });

      participant.media.emit('trackRemoved');
    });
  });
});
