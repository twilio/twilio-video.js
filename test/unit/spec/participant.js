'use strict';

var assert = require('assert');
var Participant = require('../../../lib/participant');
var ParticipantImpl = require('../../../lib/signaling/participantimpl');
var util = require('../../../lib/util');

describe('Participant', function() {
  var impl;
  var participant;

  this.timeout(200);

  beforeEach(function() {
    impl = new ParticipantImpl(util.makeUUID(), 'foo', 'connected');
    participant = new Participant(impl);
  });

  describe('new Participant(impl)', function() {
    it('should return an instance when called as a function', function() {
      assert(Participant(impl) instanceof Participant);
    });
  });

  describe.skip('events', function() {
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
