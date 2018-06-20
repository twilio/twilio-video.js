'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const DominantSpeakerSignaling = require('../../../../../lib/signaling/v2/dominantspeakersignaling');

function makeTransport() {
  const transport = new EventEmitter();
  transport.publish = () => {};
  return transport;
}

describe('DominantSpeakerSignaling', () => {
  describe('constructor(mediaSignalingTransport)', () => {
    it('initializes .loudestParticipantSid to null', () => {
      assert.strictEqual(new DominantSpeakerSignaling(makeTransport()).loudestParticipantSid, null);
    });

    describe('when mediaSignalingTransport emits a "message" event containing an Dominant Speaker message', () => {
      describe('and the Dominant Speaker message\'s .participant is new', () => {
        const participant = 'PA123';

        let mediaSignalingTransport;
        let dominantSpeakerSignaling;

        beforeEach(() => {
          mediaSignalingTransport = makeTransport();
          dominantSpeakerSignaling = new DominantSpeakerSignaling(mediaSignalingTransport);
        });

        it('updates .loudestParticipantSid', () => {
          mediaSignalingTransport.emit('message', { type: 'active_speaker', participant });
          assert.equal(dominantSpeakerSignaling.loudestParticipantSid, participant);
        });

        it('emits "updated"', () => {
          let didEmitEvent;
          dominantSpeakerSignaling.once('updated', () => { didEmitEvent = true; });
          mediaSignalingTransport.emit('message', { type: 'active_speaker', participant });
          assert(didEmitEvent);
        });
      });

      describe('and the Dominant Speaker message\'s .participant is the same', () => {
        const participant = 'PA123';

        let mediaSignalingTransport;
        let dominantSpeakerSignaling;

        beforeEach(() => {
          mediaSignalingTransport = makeTransport();
          dominantSpeakerSignaling = new DominantSpeakerSignaling(mediaSignalingTransport);
          mediaSignalingTransport.emit('message', { type: 'active_speaker', participant });
        });

        it('does not change .loudestParticipantSid', () => {
          mediaSignalingTransport.emit('message', { type: 'active_speaker', participant });
          assert.equal(dominantSpeakerSignaling.loudestParticipantSid, participant);
        });

        it('does not emit "updated"', () => {
          let didEmitEvent;
          dominantSpeakerSignaling.once('updated', () => { didEmitEvent = true; });
          mediaSignalingTransport.emit('message', { type: 'active_speaker', participant });
          assert(!didEmitEvent);
        });
      });
    });
  });
});
