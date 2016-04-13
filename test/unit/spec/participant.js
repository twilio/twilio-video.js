'use strict';

var assert = require('assert');
var MockDialog = require('../../mock/signaling/v1/dialog');
var Participant = require('../../../lib/participant');
var util = require('../../../lib/util');

describe('Participant', function() {
  var dialog;
  var participant;

  this.timeout(200);

  beforeEach(function() {
    dialog = new MockDialog('foo');
    participant = new Participant(util.makeUUID(), dialog);
  });

  describe('new Participant(sid, dialog)', function() {
    it('should return an instance when called as a function', function() {
      assert(Participant(util.makeUUID(), dialog) instanceof Participant);
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
