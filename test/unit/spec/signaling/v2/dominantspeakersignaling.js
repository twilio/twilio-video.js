'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const DominantSpeakerSignaling = require('../../../../../lib/signaling/v2/dominantspeakersignaling');
const { waitForSometime } = require('../../../../../lib/util');
const log = require('../../../../lib/fakelog');

function makeTransport() {
  const transport = new EventEmitter();
  transport.publish = () => {};
  return transport;
}

function makeTest(mst) {
  const getReceiver = () => {
    return Promise.resolve({
      kind: 'data',
      toDataTransport: () => mst,
      once: () => {}
    });
  };

  const subject = new DominantSpeakerSignaling(getReceiver, { log });
  subject.setup('foo');
  return subject;
}

describe('DominantSpeakerSignaling', () => {
  describe('constructor(mediaSignalingTransport)', () => {
    it('initializes .loudestParticipantSid to null', () => {
      const subject = makeTest(makeTransport());
      subject.setup('foo');
      assert.strictEqual(subject.loudestParticipantSid, null);
    });

    describe('when mediaSignalingTransport emits a "message" event containing an Dominant Speaker message', () => {
      describe('and the Dominant Speaker message\'s .participant is new', () => {
        const participant = 'PA123';

        let mediaSignalingTransport;
        let dominantSpeakerSignaling;

        beforeEach(async () => {
          mediaSignalingTransport = makeTransport();
          dominantSpeakerSignaling = makeTest(mediaSignalingTransport);
          await waitForSometime(10);
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

        beforeEach(async () => {
          mediaSignalingTransport = makeTransport();
          dominantSpeakerSignaling = makeTest(mediaSignalingTransport);
          await waitForSometime(10);
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
