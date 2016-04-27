'use strict';

var assert = require('assert');
var Participant = require('../../../lib/participant');
var ParticipantSignaling = require('../../../lib/signaling/participant');
var util = require('../../../lib/util');

describe('Participant', function() {
  var signaling;
  var participant;

  this.timeout(200);

  beforeEach(function() {
    signaling = new ParticipantSignaling(util.makeUUID(), 'foo', 'connected');
    participant = new Participant(signaling);
  });

  describe('new Participant(signaling)', function() {
    it('should return an instance when called as a function', function() {
      assert(Participant(signaling) instanceof Participant);
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
