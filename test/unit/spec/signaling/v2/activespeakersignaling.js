'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const ActiveSpeakerSignaling = require('../../../../../lib/signaling/v2/activespeakersignaling');

function makeTransport() {
  const transport = new EventEmitter();
  transport.publish = () => {};
  return transport;
}

describe('ActiveSpeakerSignaling', () => {
  describe('constructor(mediaSignalingTransport)', () => {
    it('initializes .loudestParticipantSid to null', () => {
      assert.strictEqual(new ActiveSpeakerSignaling(makeTransport()).loudestParticipantSid, null);
    });

    describe('when mediaSignalingTransport emits a "message" event containing an Active Speaker message', () => {
      describe('and the Active Speaker message\'s .participant is new', () => {
        const participant = 'PA123';

        let mediaSignalingTransport;
        let activeSpeakerSignaling;

        beforeEach(() => {
          mediaSignalingTransport = makeTransport();
          activeSpeakerSignaling = new ActiveSpeakerSignaling(mediaSignalingTransport);
        });

        it('updates .loudestParticipantSid', () => {
          mediaSignalingTransport.emit('message', { type: 'active_speaker', participant });
          assert.equal(activeSpeakerSignaling.loudestParticipantSid, participant);
        });

        it('emits "updated"', () => {
          let didEmitEvent;
          activeSpeakerSignaling.once('updated', () => { didEmitEvent = true; });
          mediaSignalingTransport.emit('message', { type: 'active_speaker', participant });
          assert(didEmitEvent);
        });
      });

      describe('and the Active Speaker message\'s .participant is the same', () => {
        const participant = 'PA123';

        let mediaSignalingTransport;
        let activeSpeakerSignaling;

        beforeEach(() => {
          mediaSignalingTransport = makeTransport();
          activeSpeakerSignaling = new ActiveSpeakerSignaling(mediaSignalingTransport);
          mediaSignalingTransport.emit('message', { type: 'active_speaker', participant });
        });

        it('does not change .loudestParticipantSid', () => {
          mediaSignalingTransport.emit('message', { type: 'active_speaker', participant });
          assert.equal(activeSpeakerSignaling.loudestParticipantSid, participant);
        });

        it('does not emit "updated"', () => {
          let didEmitEvent;
          activeSpeakerSignaling.once('updated', () => { didEmitEvent = true; });
          mediaSignalingTransport.emit('message', { type: 'active_speaker', participant });
          assert(!didEmitEvent);
        });
      });
    });
  });
});
