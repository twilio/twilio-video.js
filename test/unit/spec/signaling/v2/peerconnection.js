'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const sinon = require('sinon');

const EventTarget = require('../../../../../lib/eventtarget');
const PeerConnectionV2 = require('../../../../../lib/signaling/v2/peerconnection');
const { MediaClientLocalDescFailedError } = require('../../../../../lib/util/twilio-video-errors');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const { a, combinationContext, makeEncodingParameters } = require('../../../../lib/util');

describe('PeerConnectionV2', () => {
  describe('constructor', () => {
    let test;

    beforeEach(() => {
      test = makeTest();
    });

    it('sets .id', () => {
      assert.equal(test.pcv2.id, test.id);
    });
  });

  describe('.iceConnectionState', () => {
    it('equals the underlying RTCPeerConnection\'s .iceConnectionState', () => {
      const test = makeTest();
      assert.equal(test.pcv2.iceConnectionState, test.pc.iceConnectionState);
      test.pc.iceConnectionState = 'failed';
      assert.equal(test.pcv2.iceConnectionState, 'failed');
    });
  });

  describe('.isApplicationSectionNegotiated', () => {
    context('when the underlying RTCPeerConnection has a local RTCSessionDescription', () => {
      [true, false].forEach(hasApplicationSection => {
        context(`when the RTCSessionDescription ${hasApplicationSection ? 'has' : 'does not have'} an application m= section`, () => {
          it(`should be set to ${hasApplicationSection}`, async () => {
            const test = makeTest({
              offers: [
                makeOffer({ application: hasApplicationSection })
              ]
            });
            // TODO(mmalavalli): Remove this line once VIDEO-1981 is fixed.
            test.pcv2._isIceLite = true;
            await test.pcv2.offer();
            assert.equal(test.pcv2.isApplicationSectionNegotiated, hasApplicationSection);
          });
        });
      });
    });
    context('when the underlying RTCPeerConnection does not have a local RTCSessionDescription', () => {
      it('should be set to false', async () => {
        const test = makeTest();
        // TODO(mmalavalli): Remove this line once VIDEO-1981 is fixed.
        test.pcv2._isIceLite = true;
        assert.equal(test.pcv2.isApplicationSectionNegotiated, false);
      });
    });
  });

  describe('"iceConnectionStateChanged"', () => {
    it('emits "iceConnectionStateChanged" when the underlying RTCPeerConnection emits "iceconnectionstatechange"', () => {
      const test = makeTest();
      let didEmit = false;
      test.pcv2.once('iceConnectionStateChanged', () => { didEmit = true; });
      test.pc.emit('iceconnectionstatechange');
      assert(didEmit);
    });
  });

  describe('#addDataTrackSender, called with a DataTrackSender that has', () => {
    let test;
    let dataTrackSender;

    beforeEach(() => {
      test = makeTest();
      dataTrackSender = makeDataTrackSender();
    });

    describe('never been added', () => {
      describe('calls createDataChannel on the underlying RTCPeerConnection, and,', () => {
        let result;

        describe('if that call succeeds,', () => {
          beforeEach(() => {
            test.pc.createDataChannel = sinon.spy(test.pc.createDataChannel.bind(test.pc));
            result = test.pcv2.addDataTrackSender(dataTrackSender);
            sinon.assert.calledOnce(test.pc.createDataChannel);
            assert.deepEqual(test.pc.createDataChannel.args[0][1], {
              maxPacketLifeTime: dataTrackSender.maxPacketLifeTime,
              maxRetransmits: dataTrackSender.maxRetransmits,
              ordered: dataTrackSender.ordered
            });
          });

          it('calls addDataChannel on the DataTrackSender with the resulting RTCDataChannel', () => {
            sinon.assert.calledOnce(dataTrackSender.addDataChannel);
            sinon.assert.calledWith(dataTrackSender.addDataChannel, test.pc.dataChannels[0]);
          });

          it('returns undefined', () => {
            assert.equal(result, undefined);
          });
        });

        describe('if that call fails,', () => {
          beforeEach(() => {
            test.pc.createDataChannel = () => { throw new Error(); };
            result = test.pcv2.addDataTrackSender(dataTrackSender);
          });

          it('returns undefined', () => {
            assert.equal(result, undefined);
          });
        });
      });
    });

    describe('already been added', () => {
      let result;

      beforeEach(() => {
        test.pcv2.addDataTrackSender(dataTrackSender);

        test.pc.createDataChannel = sinon.spy(test.pc.createDataChannel.bind(test.pc));
        result = test.pcv2.addDataTrackSender(dataTrackSender);
      });

      it('does not call createDataChannel on the underlying RTCPeerConnection', () => {
        sinon.assert.notCalled(test.pc.createDataChannel);
      });

      it('returns undefined', () => {
        assert.equal(result, undefined);
      });
    });

    describe('been removed', () => {
      let result;

      beforeEach(() => {
        test.pcv2.addDataTrackSender(dataTrackSender);
        test.pcv2.removeDataTrackSender(dataTrackSender);
        dataTrackSender.addDataChannel.reset();
      });

      describe('calls createDataChannel on the underlying RTCPeerConnection, and,', () => {
        describe('if that call succeeds,', () => {
          beforeEach(() => {
            test.pc.createDataChannel = sinon.spy(test.pc.createDataChannel.bind(test.pc));
            result = test.pcv2.addDataTrackSender(dataTrackSender);
            sinon.assert.calledOnce(test.pc.createDataChannel);
            sinon.assert.calledWith(test.pc.createDataChannel, dataTrackSender.id);
          });

          it('calls addDataChannel on the DataTrackSender with the resulting RTCDataChannel', () => {
            sinon.assert.calledOnce(dataTrackSender.addDataChannel);
            sinon.assert.calledWith(dataTrackSender.addDataChannel, test.pc.dataChannels[1]);
          });

          it('returns undefined', () => {
            assert.equal(result, undefined);
          });
        });

        describe('if that call fails,', () => {
          beforeEach(() => {
            test.pc.createDataChannel = () => { throw new Error(); };
            result = test.pcv2.addDataTrackSender(dataTrackSender);
          });

          it('returns undefined', () => {
            assert.equal(result, undefined);
          });
        });
      });
    });
  });

  describe('#addMediaTrackSender, called with a MediaTrackSender that has', () => {
    let test;
    let stream;
    let result;

    [
      ['never been added', () => {}],
      ['been added', (test, trackSender) => {
        test.pcv2.addMediaTrackSender(trackSender);
      }],
      ['been removed', (test, trackSender) => {
        test.pcv2.addMediaTrackSender(trackSender);
        test.pcv2.removeMediaTrackSender(trackSender);
      }]
    ].forEach(([scenario, setup]) => {
      context(scenario, () => {
        beforeEach(() => {
          test = makeTest();
          const tracks = [{ id: 1 }];
          stream = { getTracks() { return tracks; } };
          const trackSender = makeMediaTrackSender(tracks[0]);
          setup(test, trackSender);
          test.pc.addTrack = sinon.spy(() => {});
          result = test.pcv2.addMediaTrackSender(trackSender);
        });

        it('returns undefined', () => {
          assert.equal(result);
        });

        if (scenario === 'been added') {
          it('does not call addTrack on the underlying RTCPeerConnection', () => {
            sinon.assert.notCalled(test.pc.addTrack);
          });
          return;
        }

        it('calls addTrack on the underlying RTCPeerConnection', () => {
          sinon.assert.calledWith(test.pc.addTrack, stream.getTracks()[0]);
        });
      });
    });
  });

  describe('#close', () => {
    ['closed', 'stable', 'have-local-offer'].forEach(signalingState => {
      let test;
      let before;
      let result;
      let description;
      const revision = signalingState === 'have-local-offer' ? 2 : 1;

      context(`in signaling state ${signalingState}`, () => {
        beforeEach(async () => {
          test = makeTest({ offers: 1 });

          switch (signalingState) {
            case 'closed':
              test.pcv2.close();
              break;
            case 'stable':
              break;
            case 'have-local-offer':
              await test.pcv2.offer();
              break;
          }

          const nextDescription = new Promise(resolve => test.pcv2.once('description', resolve));

          test.pc.close = sinon.spy(test.pc.close);
          before = test.pcv2.getState();
          result = test.pcv2.close();

          if (signalingState !== 'closed') {
            description = await nextDescription;
          }
        });

        it('returns undefined', () => {
          assert.equal(result);
        });

        if (signalingState === 'closed') {
          it('does not call close on the underlying RTCPeerConnection', () => {
            sinon.assert.notCalled(test.pc.close);
          });

          it('does not update the state', () => {
            assert.deepEqual(test.pcv2.getState(), before);
          });
        } else {
          it('calls close on the underlying RTCPeerConnection', () => {
            sinon.assert.calledOnce(test.pc.close);
          });

          it('sets the local description to a close description and increments the revision', () => {
            assert.deepEqual(test.pcv2.getState(), test.state().setDescription(makeClose(), revision));
          });

          it('emits a "description" event with the new local description', () => {
            assert.deepEqual(description, test.state().setDescription(makeClose(), revision));
          });
        }
      });
    });

    it('removes RTCDataChannels from any DataTrackSenders currently added to the PeerConnectionV2', () => {
      const test = makeTest();
      const dataTrackSender1 = makeDataTrackSender();
      const dataTrackSender2 = makeDataTrackSender();
      test.pcv2.addDataTrackSender(dataTrackSender1);
      test.pcv2.addDataTrackSender(dataTrackSender2);
      test.pcv2.removeDataTrackSender(dataTrackSender1);
      dataTrackSender1.removeDataChannel.reset();
      test.pcv2.close();
      sinon.assert.notCalled(dataTrackSender1.removeDataChannel);
      sinon.assert.calledOnce(dataTrackSender2.removeDataChannel);
      sinon.assert.calledWith(dataTrackSender2.removeDataChannel, test.pc.dataChannels[1]);
    });
  });

  describe('#getTrackReceivers', () => {
    it('returns DataTrackReceivers and MediaTrackReceivers for any RTCDataChannels and MediaStreamTracks raised by the underlying RTCPeerConnection that have yet to be closed/ended', () => {
      const test = makeTest();
      const dataChannel1 = makeDataChannel();
      const dataChannel2 = makeDataChannel();
      const dataChannel3 = makeDataChannel();
      const mediaTrack1 = new FakeMediaStreamTrack('audio');
      const mediaTrack2 = new FakeMediaStreamTrack('video');

      function getTrackIdOrChannelLabel({ id, label }) {
        return id || label;
      }

      test.pc.dispatchEvent({ type: 'datachannel', channel: dataChannel1 });
      test.pc.dispatchEvent({ type: 'datachannel', channel: dataChannel2 });
      test.pc.dispatchEvent({ type: 'datachannel', channel: dataChannel3 });
      test.pc.dispatchEvent({ type: 'track', track: mediaTrack1 });
      test.pc.dispatchEvent({ type: 'track', track: mediaTrack2 });

      assert.deepEqual(test.pcv2.getTrackReceivers().map(receiver => receiver.id),
       [dataChannel1, dataChannel2, dataChannel3, mediaTrack1, mediaTrack2].map(getTrackIdOrChannelLabel));

      dataChannel1.dispatchEvent({ type: 'close' });
      mediaTrack1.dispatchEvent({ type: 'ended' });

      assert.deepEqual(test.pcv2.getTrackReceivers().map(receiver => receiver.id),
        [dataChannel2, dataChannel3, mediaTrack2].map(getTrackIdOrChannelLabel));
    });
  });

  describe('#getState', () => {
    [
      [
        'before setting a local description',
        () => {},
        () => null
      ],
      [
        'after setting a local description by calling #close',
        test => test.pcv2.close(),
        test => test.state().setDescription(makeClose(), 1)
      ],
      [
        'after setting a local description by calling #offer',
        test => test.pcv2.offer(),
        test => test.state().setDescription(test.offers[0], 1)
      ],
      [
        'after setting a local description by calling #update with an answer description',
        async test => {
          await test.pcv2.offer();
          await test.pcv2.update(test.state().setDescription(makeAnswer(), 1));
        },
        test => test.state().setDescription(test.offers[0], 1)
      ],
      [
        'after setting a local description by calling #update with a close description',
        test => test.pcv2.update(test.state().setDescription(makeClose(), 1)),
        () => null
      ],
      [
        'after setting a local description by calling #update with an offer description',
        test => test.pcv2.update(test.state().setDescription(makeOffer(), 1)),
        test => test.state().setDescription(test.answers[0], 1)
      ]
    ].forEach(([description, before, expectedState]) => {
      let test;

      context(description, () => {
        beforeEach(async () => {
          test = makeTest({ offers: 1, answers: 1 });
          await before(test);
        });

        it('returns the local description', () => {
          assert.deepEqual(test.pcv2.getState(), expectedState(test));
        });
      });
    });
  });

  describe('#offer', () => {
    combinationContext([
      [
        ['stable', 'have-local-offer'],
        x => `in signaling state "${x}"`
      ]
    ], ([signalingState]) => {
      let test;
      let descriptions;
      let rev;
      let stateBefore;
      let signalingStateBefore;
      let result;

      if (signalingState === 'have-local-offer') {
        beforeEach(setup);
        return itShouldEventuallyCreateOffer();
      }

      beforeEach(setup);
      return itShouldCreateOffer();

      async function setup() {
        test = makeTest({ offers: [makeOffer({ session: 1 }), makeOffer({ session: 2 }), makeOffer({ session: 3 })] });
        descriptions = [];
        rev = 0;

        switch (signalingState) {
          case 'stable':
            break;
          default: // 'have-local-offer'
            await test.pcv2.offer();
            break;
        }

        test.pcv2.on('description', description => descriptions.push(description));
        test.pc.createOffer = sinon.spy(test.pc.createOffer);
        test.pc.setLocalDescription = sinon.spy(test.pc.setLocalDescription);

        stateBefore = test.pcv2.getState();
        signalingStateBefore = test.pc.signalingState;

        result = await test.pcv2.offer();
      }

      function itShouldCreateOffer() {
        const expectedOfferIndex = {
          'stable': 0,
          'have-local-offer': 1
        }[signalingState];

        it('returns a Promise that resolves to undefined', () => {
          assert.equal(result);
        });

        it('should call createOffer on the underlying RTCPeerConnection', () => {
          sinon.assert.calledOnce(test.pc.createOffer);
        });

        // NOTE(mroberts): This test should really be extended. Instead of popping
        // arguments off of `setCodecPreferences`, we should validate that we
        // apply transformed remote SDPs and emit transformed local SDPs.
        it('should transform the resulting offer by applying any codec preferences', () => {
          const preferredVideoCodecs = test.setCodecPreferences.args[0].pop();
          const preferredAudioCodecs = test.setCodecPreferences.args[0].pop();
          assert.equal(preferredAudioCodecs, test.preferredCodecs.audio);
          assert.equal(preferredVideoCodecs, test.preferredCodecs.video);
        });

        it('should call setLocalDescription on the underlying RTCPeerConnection with the transformed offer', () => {
          sinon.assert.calledOnce(test.pc.setLocalDescription);
          sinon.assert.calledWith(test.pc.setLocalDescription, test.offers[expectedOfferIndex]);
        });

        it('should emit a "description" event with the PeerConnectionV2 state set to the transformed offer at the newer revision', () => {
          const expectedRev = signalingState === 'have-local-offer' ? rev + 2 : rev + 1;
          assert.equal(descriptions.length, 1);
          assert.deepEqual(descriptions[0], test.state().setDescription(test.offers[expectedOfferIndex], expectedRev));
        });

        it('should set the state on the PeerConnectionV2 to the transformed offer at the newer revision', () => {
          const expectedRev = signalingState === 'have-local-offer' ? rev + 2 : rev + 1;
          assert.deepEqual(test.pcv2.getState(), test.state().setDescription(test.offers[expectedOfferIndex], expectedRev));
        });

        it('should leave the underlying RTCPeerConnection in signalingState "have-local-offer"', () => {
          assert.equal(test.pc.signalingState, 'have-local-offer');
        });
      }

      function itShouldEventuallyCreateOffer() {
        it('returns a Promise that resolves to undefined', () => {
          assert.equal(result);
        });

        it('should not emit a "description" event', () => {
          assert.equal(descriptions.length, 0);
        });

        it('should not change the state on the PeerConnectionV2', () => {
          assert.deepEqual(test.pcv2.getState(), stateBefore);
        });

        it('should not change the signalingState on the underlying RTCPeerConnection', () => {
          assert.equal(test.pc.signalingState, signalingStateBefore);
        });

        context('then, once the initial answer is received', () => {
          beforeEach(async () => {
            const answer = makeAnswer();
            const answerDescription = test.state().setDescription(answer, 1);
            await test.pcv2.update(answerDescription);
          });

          itShouldCreateOffer();
        });
      }
    });

    // TODO(mroberts): Would be nice to somehow consolidate this with the
    // `beforeEach` call (or move it out).
    ['createOffer', 'setLocalDescription'].forEach(errorScenario => {
      let test;

      beforeEach(async () => {
        test = makeTest({ offers: 2 });

        await Promise.all([
          new Promise(resolve => test.pcv2.once('description', resolve)),
          test.pcv2.offer()
        ]);
      });

      context(`when ${errorScenario} on the underlying RTCPeerConnection fails`, () => {
        it('should throw a MediaClientLocalDescFailedError', async () => {
          const test = makeTest({ offers: 1, errorScenario });
          try {
            await test.pcv2.offer();
          } catch (error) {
            assert(error instanceof MediaClientLocalDescFailedError);
            assert.equal(error.code, 53400);
            return;
          }
          throw new Error('Unexpected resolution');
        });
      });
    });
  });

  describe('#removeDataTrackSender, called with a DataTrackSender that has', () => {
    let test;
    let dataTrackSender;
    let result;

    beforeEach(() => {
      test = makeTest();
      dataTrackSender = makeDataTrackSender();
    });

    describe('never been added', () => {
      beforeEach(() => {
        result = test.pcv2.removeDataTrackSender(dataTrackSender);
      });

      it('does not call removeDataChannel on the DataTrackSender', () => {
        sinon.assert.notCalled(dataTrackSender.removeDataChannel);
      });

      it('returns undefined', () => {
        assert.equal(result, undefined);
      });
    });

    describe('been added', () => {
      beforeEach(() => {
        test.pcv2.addDataTrackSender(dataTrackSender);
        result = test.pcv2.removeDataTrackSender(dataTrackSender);
      });

      it('calls removeDataChannel on the DataTrackSender with the underlying RTCDataChannel', () => {
        sinon.assert.calledOnce(dataTrackSender.removeDataChannel);
        sinon.assert.calledWith(dataTrackSender.removeDataChannel, test.pc.dataChannels[0]);
      });

      it('calls .close on the underlying RTCDataChannel', () => {
        sinon.assert.calledOnce(test.pc.dataChannels[0].close);
      });

      it('returns undefined', () => {
        assert.equal(result, undefined);
      });
    });

    describe('been removed', () => {
      beforeEach(() => {
        test.pcv2.addDataTrackSender(dataTrackSender);
        test.pcv2.removeDataTrackSender(dataTrackSender);
        test.pc.dataChannels[0].close.reset();
        dataTrackSender.removeDataChannel.reset();
        result = test.pcv2.removeDataTrackSender(dataTrackSender);
      });

      it('does not call removeDataChannel on the DataTrackSender', () => {
        sinon.assert.notCalled(dataTrackSender.removeDataChannel);
      });

      it('does not call .close on the underlying RTCDataChannel', () => {
        sinon.assert.notCalled(test.pc.dataChannels[0].close);
      });

      it('returns undefined', () => {
        assert.equal(result, undefined);
      });
    });
  });

  describe('#removeMediaTrackSender', () => {
    let test;
    let stream;
    let result;

    [
      ['never been added', () => {}],
      ['been added', (test, trackSender) => {
        test.pcv2.addMediaTrackSender(trackSender);
      }],
      ['been removed', (test, trackSender) => {
        test.pcv2.addMediaTrackSender(trackSender);
        test.pcv2.removeMediaTrackSender(trackSender);
      }]
    ].forEach(([scenario, setup]) => {
      context(scenario, () => {
        beforeEach(() => {
          test = makeTest();
          const tracks = [{ id: 1 }];
          stream = { getTracks() { return tracks; } };
          const trackSender = makeMediaTrackSender(tracks[0]);
          setup(test, trackSender, stream);
          test.pc.removeTrack = sinon.spy(() => {});
          result = test.pcv2.removeMediaTrackSender(trackSender);
        });

        it('returns undefined', () => {
          assert.equal(result);
        });

        if (scenario === 'been added') {
          it('calls removeTrack on the underlying RTCPeerConnection', () => {
            assert.equal(test.pc.removeTrack.args[0][0].track, stream.getTracks()[0]);
          });
          return;
        }

        it('does not call removeTrack on the underlying RTCPeerConnection', () => {
          sinon.assert.notCalled(test.pc.removeTrack);
        });
      });
    });
  });

  describe('#setConfiguration', () => {
    let test;

    beforeEach(() => {
      test = makeTest();
    });

    context('when setConfiguration is supported by the underlying RTCPeerConnection', () => {
      it('calls setConfiguration on the underlying RTCPeerConnection', () => {
        let configuration;
        test.pc.setConfiguration = _configuration => {
          configuration = _configuration;
        };

        test.pcv2.setConfiguration({
          iceServers: ['foo'],
          iceTransportPolicy: 'bar'
        });

        assert.deepEqual(
          configuration,
          {
            bundlePolicy: 'max-bundle',
            iceServers: ['foo'],
            iceTransportPolicy: 'bar',
            rtcpMuxPolicy: 'require'
          });
      });
    });

    context('when setConfiguration is not supported by the underlying RTCPeerConnection', () => {
      it('does not call setConfiguration on the underlying RTCPeerConnection', () => {
        test.pcv2.setConfiguration({ fizz: 'buzz' });
      });
    });
  });

  describe('#update, called', () => {
    combinationContext([
      [
        [true, false],
        x => `${x ? 'before' : 'after'} the initial round of negotiation`
      ],
      [
        ['stable', 'have-local-offer', 'closed'],
        x => `in signalingState "${x}"`
      ],
      [
        ['offer', 'answer', 'create-offer', 'close'],
        x => `with ${a(x)} "${x}" description`
      ],
      [
        ['newer', 'equal', 'older'],
        x => `at ${a(x)} ${x} revision`
      ],
      [
        [true, false],
        x => `when matching ICE candidates have ${x ? '' : 'not '}been received`
      ],
      [
        [true, false],
        x => `when the remote peer is ${x ? '' : 'not '}an ICE-lite agent`
      ]
    ], ([initial, signalingState, type, newerEqualOrOlder, matching, iceLite]) => {
      // The Test
      let test;

      // Any candidates passed to `update`.
      let candidates;

      // The Description passed to `update`
      let desc;

      // The Description's revision
      let rev;

      // Description events emitted by the PeerConnectionV2
      let descriptions;

      // The PeerConnectionV2's state before calling `update`
      let stateBefore;

      // The underlying RTCPeerConnection's signalignState before calling `update`
      let signalingStateBefore;

      // The result of calling `update`
      let result;

      async function setup() {
        test = makeTest({
          offers: 3,
          answers: 2,
          maxAudioBitrate: 40,
          maxVideoBitrate: 50
        });
        descriptions = [];
        const ufrag = 'foo';

        // NOTE(mroberts): If this test takes place after an initial round of
        // negotiation, then we need to `offer` and `update` with an answer.
        // The first `offer` should always set the Description revision to 1;
        // hence, we answer with revision 1.
        if (!initial) {
          await test.pcv2.offer();
          const answer = makeAnswer({ iceLite });
          const answerDescription = test.state().setDescription(answer, 1);
          await test.pcv2.update(answerDescription);
        }

        // NOTE(mroberts): Transition to the desired `signalingState`.
        switch (signalingState) {
          case 'stable':
            break;
          case 'have-local-offer':
            await test.pcv2.offer();
            break;
          default: // 'closed'
            test.pcv2.close();
            break;
        }

        rev = test.pcv2._lastStableDescriptionRevision;
        switch (newerEqualOrOlder) {
          case 'newer':
            rev += 2;
            break;
          case 'equal':
            if (type === 'answer') {
              rev++;
            }
            break;
          default: // 'older'
            if (type === 'answer') {
              break;
            }
            rev--;
            break;
        }

        // NOTE(mroberts): Construct the requested Description.
        desc = null;
        switch (type) {
          case 'offer': {
            const offer = makeOffer({ iceLite, ufrag });
            desc = test.state().setDescription(offer, rev);
            break;
          }
          case 'answer': {
            const answer = makeAnswer({ iceLite, ufrag });
            desc = test.state().setDescription(answer, rev);
            break;
          }
          case 'create-offer': {
            const createOffer = makeCreateOffer();
            desc = test.state().setDescription(createOffer, rev);
            break;
          }
          default: { // 'close'
            const close = makeClose();
            desc = test.state().setDescription(close, rev);
            break;
          }
        }

        // NOTE(mroberts): Setup spies and capture "description" events.
        test.pcv2.on('description', description => descriptions.push(description));
        test.pc.addIceCandidate = sinon.spy(test.pc.addIceCandidate);
        test.pc.close = sinon.spy(test.pc.close);
        test.pc.createAnswer = sinon.spy(test.pc.createAnswer);
        test.pc.createOffer = sinon.spy(test.pc.createOffer);
        test.pc.setLocalDescription = sinon.spy(test.pc.setLocalDescription);
        test.pc.setRemoteDescription = sinon.spy(test.pc.setRemoteDescription);

        stateBefore = test.pcv2.getState();
        signalingStateBefore = test.pc.signalingState;

        if (matching) {
          const ice = makeIce(ufrag, 2);
          candidates = ice.candidates;

          const iceState = test.state().setIce(ice);
          await test.pcv2.update(iceState);

          // NOTE(mroberts): Sanity check.
          sinon.assert.notCalled(test.pc.addIceCandidate);
          assert.deepEqual(test.pcv2.getState(), stateBefore);
          assert.deepEqual(test.pc.signalingState, signalingStateBefore);
        }

        result = await test.pcv2.update(desc);
      }

      if (signalingState !== 'closed') {
        switch (type) {
          case 'offer':
            if (newerEqualOrOlder !== 'newer') {
              break;
            }
            beforeEach(setup);
            if (signalingState === 'have-local-offer') {
              if (initial) {
                return itMightEventuallyAnswer();
              }
              return itShouldHandleGlare();
            }
            return itShouldAnswer();
          case 'answer':
            if (newerEqualOrOlder !== 'equal' || signalingState !== 'have-local-offer') {
              break;
            }
            beforeEach(setup);
            return itShouldApplyAnswer();
          case 'create-offer':
            if (newerEqualOrOlder !== 'newer') {
              break;
            }
            beforeEach(setup);
            if (signalingState === 'have-local-offer') {
              return itShouldEventuallyCreateOffer();
            }
            return itShouldCreateOffer();
          default: // 'close'
            beforeEach(setup);
            return itShouldClose();
        }
      }

      beforeEach(setup);
      itDoesNothing();

      function itShouldApplyBandwidthConstraints() {
        it('should apply the specified bandwidth constraints to the remote description', () => {
          const maxVideoBitrate = test.setBitrateParameters.args[0].pop();
          const maxAudioBitrate = test.setBitrateParameters.args[0].pop();
          assert.equal(maxAudioBitrate, test.maxAudioBitrate);
          assert.equal(maxVideoBitrate, test.maxVideoBitrate);
        });
      }

      // NOTE(mroberts): This test should really be extended. Instead of popping
      // arguments off of `setCodecPreferences`, we should validate that we
      // apply transformed remote SDPs and emit transformed local SDPs.
      function itShouldApplyCodecPreferences() {
        it('should apply the specified codec preferences to the remote description', () => {
          const preferredVideoCodecs = test.setCodecPreferences.args[0].pop();
          const preferredAudioCodecs = test.setCodecPreferences.args[0].pop();
          assert.equal(preferredAudioCodecs, test.preferredCodecs.audio);
          assert.equal(preferredVideoCodecs, test.preferredCodecs.video);
        });
      }

      function itShouldAnswer() {
        it('returns a Promise that resolves to undefined', () => {
          assert.equal(result);
        });

        it('should call createAnswer on the underlying RTCPeerConnection', () => {
          sinon.assert.calledOnce(test.pc.createAnswer);
        });

        it('should call setLocalDescription on the underlying RTCPeerConnection with the resulting answer', () => {
          sinon.assert.calledOnce(test.pc.setLocalDescription);
          sinon.assert.calledWith(test.pc.setLocalDescription, test.answers[0]);
        });

        it('should emit a "description" event with the PeerConnectionV2 state set to the resulting answer at the same revision', () => {
          assert.equal(descriptions.length, 1);
          assert.deepEqual(descriptions[0], test.state().setDescription(test.answers[0], rev));
        });

        it('should set the state on the PeerConnectionV2 to the resulting answer at the same revision', () => {
          assert.deepEqual(test.pcv2.getState(), test.state().setDescription(test.answers[0], rev));
        });

        it('should leave the underlying RTCPeerConnection in signalingState "stable"', () => {
          assert.equal(test.pc.signalingState, 'stable');
        });

        it(`should detect ${iceLite ? '' : 'non-'}ICE-lite remote peer`, () => {
          assert.equal(test.pcv2._isIceLite, iceLite);
        });

        itShouldApplyBandwidthConstraints();
        itShouldApplyCodecPreferences();
      }

      function itMightEventuallyAnswer() {
        itDoesNothing();

        context('then, once the initial answer is received', () => {
          beforeEach(async () => {
            const answer = makeAnswer({ iceLite });
            const answerDescription = test.state().setDescription(answer, 1);
            await test.pcv2.update(answerDescription);
          });

          if (newerEqualOrOlder === 'newer') {
            return itShouldAnswer();
          }

          it('returns a Promise that resolves to undefined', () => {
            assert.equal(result);
          });

          it('should not emit a "description" event', () => {
            assert.equal(descriptions.length, 0);
          });

          it('should not change the state on the PeerConnectionV2', () => {
            assert.deepEqual(test.pcv2.getState(), stateBefore);
          });

          it('should leave the underlying RTCPeerConnection in signalingState "stable"', () => {
            assert.equal(test.pc.signalingState, 'stable');
          });

          itShouldApplyBandwidthConstraints();
          itShouldApplyCodecPreferences();
        });
      }

      function itShouldHandleGlare() {
        const expectedOfferIndex = initial ? 1 : 2;

        it('returns a Promise that resolves to undefined', () => {
          assert.equal(result);
        });

        it('should call setLocalDescription on the underlying RTCPeerConnection with a rollback description', () => {
          assert.deepEqual(test.pc.setLocalDescription.args[0][0], { type: 'rollback' });
        });

        it('should call setRemoteDescription on the underlying RTCPeerConnection with the offer', () => {
          sinon.assert.calledOnce(test.pc.setRemoteDescription);
          sinon.assert.calledWith(test.pc.setRemoteDescription, desc.description);
        });

        if (matching) {
          it('should call addIceCandidate on the underlying RTCPeerConnection with any previously-received, matching ICE candidates', () => {
            sinon.assert.calledTwice(test.pc.addIceCandidate);
            sinon.assert.calledWith(test.pc.addIceCandidate, candidates[0]);
            sinon.assert.calledWith(test.pc.addIceCandidate, candidates[1]);
          });
        } else {
          it('should not call addIceCandidate on the underlying RTCPeerConnection', () => {
            sinon.assert.notCalled(test.pc.addIceCandidate);
          });
        }

        it('should call createAnswer on the underlying RTCPeerConnection', () => {
          sinon.assert.calledOnce(test.pc.createAnswer);
        });

        it('should call setLocalDescription on the underlying RTCPeerConnection with the resulting answer', () => {
          assert.deepEqual(test.pc.setLocalDescription.args[1][0], test.answers[0]);
        });

        it('should emit a "description" event with the PeerConnectionV2 state set to the resulting answer at the new revision', () => {
          assert.deepEqual(descriptions[0], test.state().setDescription(test.answers[0], rev));
        });

        it('should call createOffer on the underlying RTCPeerConnection', () => {
          sinon.assert.calledOnce(test.pc.createOffer);
        });

        it('should call setLocalDescription on the underlying RTCPeerConnection with the resulting offer', () => {
          sinon.assert.calledThrice(test.pc.setLocalDescription);
          sinon.assert.calledWith(test.pc.setLocalDescription, test.offers[expectedOfferIndex]);
        });

        it('should emit a "description" event with the PeerConnectionV2 state set to the resulting offer at the newer revision', () => {
          assert.equal(descriptions.length, 2);
          assert.deepEqual(descriptions[1], test.state().setDescription(test.offers[expectedOfferIndex], rev + 1));
        });

        it('should set the state on the PeerConnectionV2 to the resulting offer at the newer revision', () => {
          assert.deepEqual(test.pcv2.getState(), test.state().setDescription(test.offers[expectedOfferIndex], rev + 1));
        });

        it('should leave the underlying RTCPeerConnection in signalingState "have-local-offer"', () => {
          assert.equal(test.pc.signalingState, 'have-local-offer');
        });

        it(`should detect ${iceLite ? '' : 'non-'}ICE-lite remote peer`, () => {
          assert.equal(test.pcv2._isIceLite, iceLite);
        });

        itShouldApplyBandwidthConstraints();
        itShouldApplyCodecPreferences();
      }

      function itShouldApplyAnswer() {
        it('returns a Promise that resolves to undefined', () => {
          assert.equal(result);
        });

        it('should call setRemoteDescrption on the underlying RTCPeerConnection', () => {
          sinon.assert.calledOnce(test.pc.setRemoteDescription);
          sinon.assert.calledWith(test.pc.setRemoteDescription, desc.description);
        });

        if (matching) {
          it('should call addIceCandidate on the underlying RTCPeerConnection with any previously-received, matching ICE candidates', () => {
            sinon.assert.calledTwice(test.pc.addIceCandidate);
            sinon.assert.calledWith(test.pc.addIceCandidate, candidates[0]);
            sinon.assert.calledWith(test.pc.addIceCandidate, candidates[1]);
          });
        } else {
          it('should not call addIceCandidate on the underlying RTCPeerConnection', () => {
            sinon.assert.notCalled(test.pc.addIceCandidate);
          });
        }

        it('should not emit a "description" event', () => {
          assert.equal(descriptions.length, 0);
        });

        it('should not change the state on the PeerConnectionV2', () => {
          assert.deepEqual(test.pcv2.getState(), stateBefore);
        });

        it('should leave the underlying RTCPeerConnection in signalingState "stable"', () => {
          assert.equal(test.pc.signalingState, 'stable');
        });

        it(`should detect ${iceLite ? '' : 'non-'}ICE-lite remote peer`, () => {
          assert.equal(test.pcv2._isIceLite, iceLite);
        });

        itShouldApplyBandwidthConstraints();
        itShouldApplyCodecPreferences();
      }

      function itShouldCreateOffer() {
        let expectedOfferIndex = initial ? 0 : 1;
        expectedOfferIndex += signalingState === 'have-local-offer' ? 1 : 0;

        it('returns a Promise that resolves to undefined', () => {
          assert.equal(result);
        });

        it('should call createOffer on the underlying RTCPeerConnection', () => {
          sinon.assert.calledOnce(test.pc.createOffer);
        });

        it('should call setLocalDescription on the underlying RTCPeerConnection with the resulting offer', () => {
          sinon.assert.calledOnce(test.pc.setLocalDescription);
          sinon.assert.calledWith(test.pc.setLocalDescription, test.offers[expectedOfferIndex]);
        });

        it('should emit a "description" event with the PeerConnectionV2 state set to the resulting offer at the newer revision', () => {
          assert.equal(descriptions.length, 1);
          assert.deepEqual(descriptions[0], test.state().setDescription(test.offers[expectedOfferIndex], rev + 1));
        });

        it('should set the state on the PeerConnectionV2 to the resulting offer at the newer revision', () => {
          assert.deepEqual(test.pcv2.getState(), test.state().setDescription(test.offers[expectedOfferIndex], rev + 1));
        });

        it('should leave the underlying RTCPeerConnection in signalingState "have-local-offer"', () => {
          assert.equal(test.pc.signalingState, 'have-local-offer');
        });

        itShouldApplyCodecPreferences();
      }

      function itShouldEventuallyCreateOffer() {
        let expectedOfferIndex = initial ? 0 : 1;
        expectedOfferIndex += signalingState === 'have-local-offer' ? 1 : 0;

        itDoesNothing();

        context(`then, once the ${initial ? 'initial ' : ''}answer is received`, () => {
          beforeEach(async () => {
            const answer = makeAnswer({ iceLite });
            const answerDescription = test.state().setDescription(answer, initial ? 1 : 2);
            await test.pcv2.update(answerDescription);
          });

          it('returns a Promise that resolves to undefined', () => {
            assert.equal(result);
          });

          it('should call createOffer on the underlying RTCPeerConnection', () => {
            sinon.assert.calledOnce(test.pc.createOffer);
          });

          it('should call setLocalDescription on the underlying RTCPeerConnection with the resulting offer', () => {
            sinon.assert.calledOnce(test.pc.setLocalDescription);
            sinon.assert.calledWith(test.pc.setLocalDescription, test.offers[expectedOfferIndex]);
          });

          it('should emit a "description" event with the PeerConnectionV2 state set to the resulting offer at the newer revision', () => {
            assert.equal(descriptions.length, 1);
            assert.deepEqual(descriptions[0], test.state().setDescription(test.offers[expectedOfferIndex], rev + 1));
          });

          it('should set the state on the PeerConnectionV2 to the resulting offer at the newer revision', () => {
            assert.deepEqual(test.pcv2.getState(), test.state().setDescription(test.offers[expectedOfferIndex], rev + 1));
          });

          it('should leave the underlying RTCPeerConnection in signalingState "have-local-offer"', () => {
            assert.equal(test.pc.signalingState, 'have-local-offer');
          });

          it(`should detect ${iceLite ? '' : 'non-'}ICE-lite remote peer`, () => {
            assert.equal(test.pcv2._isIceLite, iceLite);
          });

          itShouldApplyBandwidthConstraints();
          itShouldApplyCodecPreferences();
        });
      }

      function itShouldClose() {
        it('returns a Promise that resolves to undefined', () => {
          assert.equal(result);
        });

        it('should call close on the underlying RTCPeerConnection', () => {
          sinon.assert.calledOnce(test.pc.close);
        });

        it('should not emit a "description" event', () => {
          assert.equal(descriptions.length, 0);
        });

        it('should not change the state on the PeerConnectionV2', () => {
          assert.deepEqual(test.pcv2.getState(), stateBefore);
        });

        it('should leave the underlying RTCPeerConnection in signalingState "closed"', () => {
          assert.equal(test.pc.signalingState, 'closed');
        });
      }

      function itDoesNothing() {
        it('returns a Promise that resolves to undefined', () => {
          assert.equal(result);
        });

        it('should not emit a "description" event', () => {
          assert.equal(descriptions.length, 0);
        });

        it('should not change the state on the PeerConnectionV2', () => {
          assert.deepEqual(test.pcv2.getState(), stateBefore);
        });

        it('should not change the signalingState on the underlying RTCPeerConnection', () => {
          assert.equal(test.pc.signalingState, signalingStateBefore);
        });
      }
    });

    context('with candidates', () => {
      combinationContext([
        [
          [true, false],
          x => `whose username fragment ${x ? 'matches' : 'does not match'} that of`
        ],
        [
          ['offer', 'answer'],
          x => `the current remote "${x}" description`
        ],
        [
          ['newer', 'equal', 'older'],
          x => `at ${a(x)} ${x} revision`
        ]
      ], ([matches, type, newerEqualOrOlder]) => {
        let test;
        let candidatesUfrag;

        beforeEach(async () => {
          test = makeTest({ offers: 1, answers: 2 });

          const descriptionUfrag = 'foo';
          const descriptionRev = 1;

          candidatesUfrag = matches ? descriptionUfrag : 'bar';
          let candidatesRev = 1;

          if (type === 'answer') {
            await test.pcv2.offer();

            const answer = makeAnswer({ ufrag: descriptionUfrag });
            const answerDescription = test.state().setDescription(answer, descriptionRev);
            await test.pcv2.update(answerDescription);
          } else {
            const offer = makeOffer({ ufrag: descriptionUfrag });
            const offerDescription = test.state().setDescription(offer, descriptionRev);
            await test.pcv2.update(offerDescription);
          }

          let ice = makeIce(candidatesUfrag, candidatesRev);
          let iceState = test.state().setIce(ice, candidatesRev);
          test.pc.addIceCandidate = sinon.spy(test.pc.addIceCandidate);
          await test.pcv2.update(iceState);

          // NOTE(mroberts): Just a sanity check.
          if (matches) {
            assert.deepEqual(
              test.pc.addIceCandidate.args[0][0],
              { candidate: 'candidate1' });
          }

          switch (newerEqualOrOlder) {
            case 'newer':
              candidatesRev++;
              break;
            case 'equal':
              break;
            case 'older':
              candidatesRev--;
              break;
          }

          ice = makeIce(candidatesUfrag, candidatesRev);
          iceState = test.state().setIce(ice);
          test.pc.addIceCandidate = sinon.spy(test.pc.addIceCandidate);
          await test.pcv2.update(iceState);
        });

        if (matches && newerEqualOrOlder === 'newer') {
          it('calls addIceCandidate with any new ICE candidates on the underlying RTCPeerConnection', () => {
            sinon.assert.calledOnce(test.pc.addIceCandidate);
            assert.deepEqual(
              test.pc.addIceCandidate.args[0][0],
              { candidate: 'candidate2' });
          });
        } else {
          it('does nothing', () => {
            sinon.assert.notCalled(test.pc.addIceCandidate);
          });
        }

        context('if a remote description is then applied with a matching ICE username fragment', () => {
          beforeEach(async () => {
            const offer = makeOffer({ ufrag: candidatesUfrag });
            const offerDescription = test.state().setDescription(offer, 2);
            test.pc.addIceCandidate = sinon.spy(test.pc.addIceCandidate);
            await test.pcv2.update(offerDescription);
          });

          it('calls addIceCandidate with any new ICE candidates on the underlying RTCPeerConnection', () => {
            if (newerEqualOrOlder === 'newer') {
              sinon.assert.calledTwice(test.pc.addIceCandidate);
            } else {
              sinon.assert.calledOnce(test.pc.addIceCandidate);
            }
          });
        });
      });
    });
  });

  describe('#update, called in signaling state "stable", with an offer that', () => {
    [true, false].forEach(lacks => {
      describe(`${lacks ? 'lacks' : 'has'} an m= application section, when the PeerConnectionV2 has one ore more DataTrackSenders`, () => {
        // The Test
        let test;

        // The Description passed to `update`
        let desc;

        // Description events emitted by the PeerConnectionV2
        let descriptions;

        // The result of calling `update`
        let result;

        beforeEach(async () => {
          test = makeTest({
            offers: 1,
            answers: [makeAnswer({ application: !lacks })]
          });
          descriptions = [];

          const dataTrackSender = makeDataTrackSender();
          test.pcv2.addDataTrackSender(dataTrackSender);

          const offer = makeOffer({ application: !lacks });
          desc = test.state().setDescription(offer, 1);

          test.pcv2.on('description', description => descriptions.push(description));
          test.pc.createAnswer = sinon.spy(test.pc.createAnswer);
          test.pc.createOffer = sinon.spy(test.pc.createOffer);
          test.pc.setLocalDescription = sinon.spy(test.pc.setLocalDescription);
          test.pc.setRemoteDescription = sinon.spy(test.pc.setRemoteDescription);

          result = await test.pcv2.update(desc);
        });

        it('should return a Promise that resolves to undefined', () => {
          assert.equal(result);
        });

        it('should called createAnswer on the underlying RTCPeerConnection', () => {
          sinon.assert.calledOnce(test.pc.createAnswer);
        });

        it('should call setLocalDescription on the underlying RTCPeerConnection with the resulting answer', () => {
          (lacks ? sinon.assert.calledTwice : sinon.assert.calledOnce)(test.pc.setLocalDescription);
          sinon.assert.calledWith(test.pc.setLocalDescription, test.answers[0]);
        });

        it('should emit a "description" event with the PeerConnectionV2 state set to the resulting answer at the same revision', () => {
          assert.equal(descriptions.length, lacks ? 2 : 1);
          assert.deepEqual(descriptions[0], test.state().setDescription(test.answers[0], 1));
        });

        if (!lacks) {
          return;
        }

        it('should call createOffer on the underlying RTCPeerConnection', () => {
          sinon.assert.calledOnce(test.pc.createOffer);
        });

        it('should call setLocalDescription on the underlying RTCPeerConnection with the resulting answer', () => {
          sinon.assert.calledTwice(test.pc.setLocalDescription);
          sinon.assert.calledWith(test.pc.setLocalDescription, test.offers[0]);
        });

        it('should emit a "description" event with the PeerConnectionV2 state set to the resulting offer at the same revision', () => {
          assert.equal(descriptions.length, 2);
          assert.deepEqual(descriptions[1], test.state().setDescription(test.offers[0], 2));
        });
      });
    });
  });

  describe('"candidates" event', () => {
    combinationContext([
      [
        ['initial', 'subsequent', 'final'],
        x => `when the underlying RTCPeerConnection's "icecandidate" event fires ${{
          initial: 'with an initial candidate for the current username fragment',
          subsequent: 'with a subsequent candidate for the current username fragment',
          final: 'without a candidate (ICE gathering completed)'
        }[x]}`
      ],
      [
        [true, false],
        x => `when the remote peer is ${x ? '' : 'not '}an ICE-lite agent`
      ]
    ], ([which, iceLite]) => {
      let test;
      let iceState;

      before(async () => {
        test = makeTest({ offers: [makeOffer({ ufrag: 'foo' })] });
        test.pcv2._isIceLite = iceLite;

        await test.pcv2.offer();

        let iceStatePromise;

        if (which === 'initial') {
          iceStatePromise = new Promise(resolve => test.pcv2.once('candidates', resolve));
        }

        test.pc.emit('icecandidate', {
          type: 'icecandidate',
          candidate: { candidate: 'candidate1' }
        });

        if (which === 'subsequent') {
          iceStatePromise = new Promise(resolve => test.pcv2.once('candidates', resolve));
        }

        test.pc.emit('icecandidate', {
          type: 'icecandidate',
          candidate: { candidate: 'candidate2' }
        });

        if (which === 'final') {
          iceStatePromise = new Promise(resolve => test.pcv2.once('candidates', resolve));
        }

        test.pc.emit('icecandidate', {
          type: 'icecandidate',
          candidate: null
        });

        iceState = await iceStatePromise;
      });

      if (iceLite && which !== 'final') {
        it('should not emit the event', () => {
          assert.deepEqual(iceState.ice.candidates, []);
          assert(iceState.ice.complete);
        });
        return;
      }

      context('emits the event', () => {
        it('with the correct ID', () => {
          assert.equal(iceState.id, test.pcv2.id);
        });

        if (which === 'initial') {
          it('with a single-element list of ICE candidates', () => {
            assert.deepEqual(
              iceState.ice.candidates,
              [{ candidate: 'candidate1' }]);
          });
        } else {
          it(iceLite ? 'with no candidates' : 'with the full list of ICE candidates gathered up to that point', () => {
            assert.deepEqual(iceState.ice.candidates, iceLite
              ? [] : [{ candidate: 'candidate1' }, { candidate: 'candidate2' }]);
          });
        }

        if (which === 'final') {
          it('with completed set to true', () => {
            assert(iceState.ice.complete);
          });
        } else {
          it('with completed unset', () => {
            assert(!iceState.ice.complete);
          });
        }
      });
    });
  });

  describe('"trackAdded" event', () => {
    context('when "track" events are supported by the underlying RTCPeerConnection', () => {
      let test;
      let mediaStreamTrack;
      let trackReceiver;

      beforeEach(async () => {
        const pc = makePeerConnection();

        function RTCPeerConnection() {
          return pc;
        }

        RTCPeerConnection.prototype.ontrack = null;

        test = makeTest({
          RTCPeerConnection: RTCPeerConnection
        });

        mediaStreamTrack = { id: '456', addEventListener: sinon.spy(() => {}) };
        const mediaStream = { id: 'abc' };

        const trackPromise = new Promise(resolve => test.pcv2.once('trackAdded', resolve));

        pc.emit('track', {
          type: 'track',
          track: mediaStreamTrack,
          streams: [mediaStream]
        });

        trackReceiver = await trackPromise;
      });

      it('emits the "trackAdded" event with a MediaTrackReceiver', () => {
        assert.equal(trackReceiver.track, mediaStreamTrack);
      });
    });

    context('when a "datachannel" event is raised on the underlying RTCPeerConnection', () => {
      it('emits a "trackAdded" event with a DataTrackReceiver', () => {
        const test = makeTest();
        const channel = makeDataChannel();
        let trackAdded;
        test.pcv2.once('trackAdded', _trackAdded => { trackAdded = _trackAdded; });
        test.pc.dispatchEvent({ type: 'datachannel', channel });
        assert.equal(trackAdded.id, channel.label);
      });
    });
  });

  describe('when the underlying EncodingParametersImpl is updated with new values', () => {
    let test;

    before(() => {
      test = makeTest({ offers: 3, answers: 3 });
    });

    it('should emit a "description" event with a new offer', async () => {
      test.encodingParameters.update({ maxAudioBitrate: 20, maxVideoBitrate: 30 });
      const { description } = await new Promise(resolve => test.pcv2.once('description', resolve));
      assert.deepEqual({ type: description.type, sdp: description.sdp }, test.pc.localDescription);
    });
  });

  describe('ICE restart', () => {
    describe('when the underlying RTCPeerConnection\'s .iceConnectionState transitions to "failed",', () => {
      it('the PeerConnectionV2 calls .createOffer on the underlying RTCPeerConnection with .iceRestart set to true', async () => {
        const test = makeTest({ offers: 2 });

        // Do a first round of negotiation.
        await test.pcv2.offer();
        await test.pcv2.update(test.state().setDescription(makeAnswer(), 1));

        // Spy on MockPeerConnection's .createOffer method.
        test.pc.createOffer = sinon.spy(test.pc.createOffer.bind(test.pc));

        // Then, cause an ICE failure.
        test.pc.iceConnectionState = 'failed';
        test.pc.emit('iceconnectionstatechange');

        await oneTick();

        // Check .iceRestart equals true.
        assert(test.pc.createOffer.calledWith({
          iceRestart: true
        }));
      });
    });

    describe('when a remote answer is applied after restarting ICE, and then .offer is called again', () => {
      it('the PeerConnectionV2 calls .createOffer on the underlying RTCPeerConnection without setting .iceRestart to true', async () => {
        const test = makeTest({ offers: 3 });

        // Do a first round of negotiation.
        await test.pcv2.offer();
        await test.pcv2.update(test.state().setDescription(makeAnswer(), 1));

        // Then, cause an ICE failure.
        test.pc.iceConnectionState = 'failed';
        test.pc.emit('iceconnectionstatechange');

        await oneTick();

        // Apply a remote answer.
        await test.pcv2.update(test.state().setDescription(makeAnswer(), 2));

        // Spy on MockPeerConnection's .createOffer method.
        test.pc.createOffer = sinon.spy(test.pc.createOffer.bind(test.pc));

        // Create a new offer.
        await test.pcv2.offer();

        // Check .iceRestart is undefined.
        assert(test.pc.createOffer.calledWith({}));
      });
    });

    describe('when glare is detected during an ICE restart', () => {
      it('the PeerConnectionV2 will roll back, answer, and then call .createOffer on the underlying RTCPeerConnection with .iceRestart set to true', async () => {
        const test = makeTest({ offers: 3, answers: 1 });

        // Do a first round of negotiation.
        await test.pcv2.offer();
        await test.pcv2.update(test.state().setDescription(makeAnswer(), 1));

        // Spy on MockPeerConnection's .createOffer method.
        test.pc.createOffer = sinon.spy(test.pc.createOffer.bind(test.pc));

        // Then, cause an ICE failure.
        test.pc.iceConnectionState = 'failed';
        test.pc.emit('iceconnectionstatechange');

        await oneTick();

        // Check .iceRestart is true.
        assert(test.pc.createOffer.calledWith({
          iceRestart: true
        }));

        // Reset the spy.
        test.pc.createOffer.reset();

        // Trigger glare.
        await test.pcv2.update(test.state().setDescription(makeOffer(), 2));

        // Check .iceRestart is true (again).
        assert(test.pc.createOffer.calledWith({
          iceRestart: true
        }));
      });
    });

    describe('when .offer is called during an ICE restart', () => {
      it('the PeerConnectionV2 will wait until ICE is restarted to re-offer', async () => {
        const test = makeTest({ offers: 3, answers: 1 });

        // Do a first round of negotiation.
        await test.pcv2.offer();
        await test.pcv2.update(test.state().setDescription(makeAnswer(), 1));

        // Spy on MockPeerConnection's .createOffer method.
        test.pc.createOffer = sinon.spy(test.pc.createOffer.bind(test.pc));

        // Then, cause an ICE failure.
        test.pc.iceConnectionState = 'failed';
        test.pc.emit('iceconnectionstatechange');

        await oneTick();

        // Check .iceRestart is true.
        assert(test.pc.createOffer.calledWith({
          iceRestart: true
        }));

        // Reset the spy.
        test.pc.createOffer.reset();

        // Call .offer.
        await test.pcv2.offer();

        // Ensure the spy is not called.
        assert.equal(test.pc.createOffer.callCount, 0);

        // Apply a remote answer.
        await test.pcv2.update(test.state().setDescription(makeAnswer(), 2));

        // Check .iceRestart is undefined.
        assert(test.pc.createOffer.calledWith({}));
      });
    });

    [
      'connected',
      'completed'
    ].forEach(iceConnectionState => {
      describe(`when ICE is restarted, the underlying RTCPeerConnection's .iceConnectionState transitions to "${iceConnectionState}", and then back to "failed"`, () => {
        it('the PeerConnectionV2 calls .createOffer on the underyling RTCPeerConnection with .iceRestart set to true', async () => {
          const test = makeTest({ offers: 3, answers: 1 });

          // Do a first round of negotiation.
          await test.pcv2.offer();
          await test.pcv2.update(test.state().setDescription(makeAnswer(), 1));

          // Spy on MockPeerConnection's .createOffer method.
          test.pc.createOffer = sinon.spy(test.pc.createOffer.bind(test.pc));

          // Then, cause an ICE failure.
          test.pc.iceConnectionState = 'failed';
          test.pc.emit('iceconnectionstatechange');

          await oneTick();

          // Check .iceRestart is true.
          assert(test.pc.createOffer.calledWith({
            iceRestart: true
          }));

          // Apply a remote answer, and simulate a successful ICE restart.
          await test.pcv2.update(test.state().setDescription(makeAnswer(), 2));
          test.pc.iceConnectionState = iceConnectionState;
          test.pc.emit('iceconnectionstatechange');

          // Reset the spy.
          test.pc.createOffer.reset();

          // Then, cause an ICE failure (again).
          test.pc.iceConnectionState = 'failed';
          test.pc.emit('iceconnectionstatechange');

          await oneTick();

          // Check .iceRestart is true (again).
          assert(test.pc.createOffer.calledWith({
            iceRestart: true
          }));
        });
      });
    });
  });
});

/**
 * @interace TestOptions
 * @extends MockPeerConnectionOptions
 * @extends PeerConnectionV2Options
 * @property {string} [id]
 * @property {MockPeerConnection} [pc]
 * @property {PeerConnectionV2} [pcv2]
 */

/**
 * @interface Test
 * @extends TestOptions
 * @property {string} id
 * @property {MockPeerConnection} pc
 * @property {PeerConnectionV2} pcv2
 * @property {function(): PeerConnectionStateBuilder} state
 */

/**
 * @extends RTCPeerConnection
 * @property {Array<MediaStream>} localStreams
 * @property {Array<MediaStream>} remoteStreams
 * @property {number} offerIndex
 * @property {number} answerIndex
 * @property {Array<Description>} offers
 * @property {Array<Description>} answers
 * @property {?string} errorScenario
 */
class MockPeerConnection extends EventEmitter {
  /**
   * Construct a {@link MockPeerConnection}.
   * @param {Array<Description>} offers
   * @param {Array<Description>} answers
   * @param {?string} [errorScenario]
   */
  constructor(offers, answers, errorScenario) {
    super();

    this.senders = [];
    this.receivers = [];

    this.offerIndex = 0;
    this.answerIndex = 0;
    this.dataChannelIndex = 0;

    this.offers = offers;
    this.answers = answers;
    this.dataChannels = [];
    this.errorScenario = errorScenario || null;

    this.signalingState = 'stable';
    this.iceConnectionState = 'new';
    this.localDescription = null;
    this.remoteDescription = null;
  }

  addEventListener() {
    return this.addListener.apply(this, arguments);
  }

  removeEventListener() {
    return this.removeListener.apply(this, arguments);
  }

  dispatchEvent(event) {
    this.emit(event.type, event);
  }

  setLocalDescription(description) {
    if (this.errorScenario === 'setLocalDescription') {
      return Promise.reject(new Error('Testing setLocalDescription error'));
    } else if (this.signalingState === 'stable' &&
        description.type === 'offer') {
      this.signalingState = 'have-local-offer';
      this.emit('signalingstatechange');
    } else if (this.signalingState === 'have-remote-offer' &&
               (description.type === 'answer' || description.type === 'rollback')) {
      this.signalingState = 'stable';
      this.emit('signalingstatechange');
    }

    this.localDescription = description;
    return Promise.resolve();
  }

  setRemoteDescription(description) {
    if (this.errorScenario === 'setRemoteDescription') {
      return Promise.reject(new Error('Testing setRemoteDescription error'));
    } else if (this.signalingState === 'stable' &&
        description.type === 'offer') {
      this.signalingState = 'have-remote-offer';
      this.emit('signalingstatechanged');
    } else if (this.signalingState === 'have-local-offer' &&
               (description.type === 'answer' || description.type === 'rollback')) {
      this.signalingState = 'stable';
      this.emit('signalingstatechange');
    }

    this.remoteDescription = description;
    return Promise.resolve();
  }

  createOffer() {
    if (this.errorScenario === 'createOffer') {
      return Promise.reject(new Error('Testing createOffer error'));
    }

    const offer = this.offers[this.offerIndex++];
    return offer
      ? Promise.resolve(offer)
      : Promise.reject(new Error('Ran out of offers'));
  }

  createAnswer() {
    if (this.errorScenario === 'createAnswer') {
      return Promise.reject(new Error('Testing createAnswer error'));
    }

    const answer = this.answers[this.answerIndex++];
    return answer
      ? Promise.resolve(answer)
      : Promise.reject(new Error('Ran out of answers'));
  }

  createDataChannel(label, options) {
    const dataChannel = this.dataChannels[this.dataChannelIndex++] = Object.assign({
      close: sinon.spy(() => {}),
      label
    }, options);
    return dataChannel;
  }

  close() {
    this.signalingState = 'closed';
    this.emit('signalingstatechange');
  }

  addTrack(track) {
    const sender = { track };
    this.senders.push(sender);
    return sender;
  }

  removeTrack(sender) {
    const i = this.senders.indexOf(sender);
    if (i > -1) {
      this.senders.splice(i);
    }
  }

  getSenders() {
    return this.senders;
  }

  getReceivers() {
    return this.receivers;
  }

  addIceCandidate() {
    return Promise.resolve();
  }
}

/**
 * Make a random {@link PeerConnectionV2} ID.
 * @returns {number} id
 */
function makeId() {
  return Math.floor(Math.random() * 100 + 0.5);
}

/**
 * Make a random MediaStreamTrack kind.
 * @returns {string} - 'audio'|'video'
 */
function makeMediaKind() {
  const rand = Math.floor(Math.random() + 0.5);
  return rand < 0.5 ? 'audio' : 'video';
}

/**
 * The identity function.
 * @param {A} a
 * @returns {A} a
 */
function identity(a) {
  return a;
}

/**
 * @interface PeerConnectionV2Options
 * @property {string} [id]
 * @property {MockPeerConnection} [pc]
 * @property {RTCPeerConnection.} [RTCPeerConnection]
 */

/**
 * Make a {@link PeerConnectionV2}. This function extends any options object
 * you pass it.
 * @param {PeerConnectionV2Options} [options]
 * @returns {PeerConnectionV2}
 */
function makePeerConnectionV2(options) {
  options = options || {};
  options.id = options.id || makeId();

  const pc = options.pc || makePeerConnection(options);
  function RTCPeerConnection() {
    return pc;
  }

  options.RTCPeerConnection = options.RTCPeerConnection || RTCPeerConnection;
  options.setBitrateParameters = options.setBitrateParameters || sinon.spy(sdp => sdp);
  options.setCodecPreferences = options.setCodecPreferences || sinon.spy(sdp => sdp);
  options.preferredCodecs = options.preferredcodecs || { audio: [], video: [] };
  return new PeerConnectionV2(options.id, makeEncodingParameters(options), options.preferredCodecs, {
    Event: function(type) { return { type: type }; },
    RTCIceCandidate: identity,
    RTCPeerConnection: options.RTCPeerConnection,
    RTCSessionDescription: identity,
    setBitrateParameters: options.setBitrateParameters,
    setCodecPreferences: options.setCodecPreferences
  });
}

/**
 * @classdesc A {@link PeerConnectionStateBuilder} makes it easier to build the
 *   Room Signaling Protocol (RSP) payloads expected by a
 *   {@link PeerConnectionV2}.
 * @property {string} id
 */
class PeerConnectionStateBuilder {
  /**
   * Construct a {@link PeerConnectionStateBuilder}.
   * @param {string} id
   */
  constructor(id) {
    this.id = id;
  }

  /**
   * Set a description.
   * @param {RTCSessionDescriptionInit} description
   * @param {number} revision
   * @returns {this}
   */
  setDescription(description, revision) {
    this.description = Object.assign({
      revision: revision
    }, description);

    return this;
  }

  /**
   * Set ICE.
   * @param {ICE} ice
   * @returns {this}
   */
  setIce(ice) {
    this.ice = {
      candidates: ice.candidates.slice(),
      revision: ice.revision,
      ufrag: ice.ufrag
    };

    return this;
  }
}

/**
 * Make a {@link Test}. This function extends any options object you pass it.
 * @param {TestOptions} [options]
 * @returns {Test}
 */
function makeTest(options) {
  options = options || {};
  options.id = options.id || makeId();
  options.pc = options.pc || makePeerConnection(options);
  options.pcv2 = makePeerConnectionV2(options);

  const id = options.id;
  options.state = function state() {
    return new PeerConnectionStateBuilder(id);
  };

  return options;
}

/**
 * @extends RTCSessionDescription
 */
class Description {
  /**
   * Construct a {@link Description}.
   * @param {RTCSessionDescriptionInit} description
   */
  constructor(description) {
    Object.assign(this, description);
  }
}

/**
 * @interface DescriptionOptions
 * @property {string} [ufrag]
 */

/**
 * Make a {@link Description}. This function extends any options object you
 * pass it.
 * @param {string} type - "offer", "answer", "pranswer", "rollback",
 *   or "create-offer"
 * @param {DescriptionOptions} [options]
 */
function makeDescription(type, options) {
  options = options || {};

  const description = {
    type: type
  };

  if (type === 'offer' ||
      type === 'answer' ||
      type === 'pranswer') {
    const session = 'session' in options ? options.session : Number.parseInt(Math.random() * 1000);
    description.sdp = 'o=- ' + session + '\r\n';
    if (options.iceLite) {
      description.sdp += 'a=ice-lite\r\n';
    }
    if (options.application) {
      description.sdp += 'm=application foo bar baz\r\na=sendrecv\r\n';
    }
    if (options.ufrag) {
      description.sdp += 'a=ice-ufrag:' + options.ufrag + '\r\n';
    }
  }

  return new Description(description);
}

/**
 * Make a "close" {@link Description}.
 * @returns {Description}
 */
function makeClose() {
  return makeDescription('close');
}

/**
 * Make a "create-offer" {@link Description}.
 * @returns {Description}
 */
function makeCreateOffer() {
  return makeDescription('create-offer');
}

/**
 * Make a "offer" {@link Description}.
 * @returns {Description}
 */
function makeOffer(options) {
  return makeDescription('offer', options);
}

/**
 * Make a "answer" {@link Description}.
 * @returns {Description}
 */
function makeAnswer(options) {
  return makeDescription('answer', options);
}

/**
 * @interface ICE
 * @property {Array<RTCIceCandidateInit>} candidates
 * @property {number} revision
 * @property {string} ufrag
 */

/**
 * Make {@link ICE}. Count specifies both the revision and the number of ICE
 * candidates to generate.
 * @param {string} ufrag
 * @param {number} [count=0]
 * @returns {ICE}
 */
function makeIce(ufrag, count) {
  count = count || 0;

  const ice = {
    candidates: [],
    revision: count,
    ufrag: ufrag
  };

  for (let i = 0; i < count; i++) {
    ice.candidates.push({ candidate: 'candidate' + (i + 1) });
  }

  return ice;
}

function makeDataTrackSender(id) {
  id = id || makeId();
  return {
    id,
    addDataChannel: sinon.spy(() => {}),
    removeDataChannel: sinon.spy(() => {})
  };
}

function makeMediaTrackSender(track) {
  const id = track.id || makeId();
  const kind = track.kind || makeMediaKind();
  return {
    id,
    kind,
    track,
    addSender: sinon.spy(() => {}),
    removeSender: sinon.spy(() => {})
  };
}

function makeDataChannel(id) {
  id = id || makeId();
  const dataChannel = new EventTarget();
  dataChannel.close = sinon.spy(() => {});
  dataChannel.label = id;
  dataChannel.close = sinon.spy(() => {});
  return dataChannel;
}

/**
 * @interface MockPeerConnectionOptions
 * @property {number|Array<RTCSessionDescriptionInit|Description>} [offers=0] -
 *   provide a number to seed the {@link MockPeerConnection} with exactly that
 *   number of offers; otherwise, you can provide RTCSessionDescriptionInit or
 *   {@link Description} instances directly
 * @property {number|Array<RTCSessionDescriptionInit|Description>} [answers=0] -
 *   number of answers; otherwise, you can provide RTCSessionDescriptionInit or
 *   {@link Description} instances directly
 * @property {string} [errorScenario] - one of "createOffer", "createAnswer",
 *   "setLocalDescription", or "setRemoteDescription"; set to cause one of
 *   these methods to fail
 */

/**
 * Make a {@link MockPeerConnection}. This function extends any options object
 * you pass it.
 * @param {MockPeerConnectionOptions} [options]
 * @returns {MockPeerConnectionOptions}
 */
function makePeerConnection(options) {
  options = options || {};
  options.offers = options.offers || [];
  options.answers = options.answers || [];

  if (typeof options.offers === 'number') {
    const offers = [];
    for (let i = 0; i < options.offers; i++) {
      offers.push(makeOffer());
    }
    options.offers = offers;
  }

  if (typeof options.answers === 'number') {
    const answers = [];
    for (let i = 0; i < options.answers; i++) {
      answers.push(makeAnswer());
    }
    options.answers = answers;
  }

  options.offers = options.offers.map(description =>
    description instanceof Description
      ? description
      : new Description(description));

  options.answers = options.answers.map(description =>
    description instanceof Description
      ? description
      : new Description(description));

  return new MockPeerConnection(
    options.offers,
    options.answers,
    options.errorScenario);
}

function oneTick() {
  return new Promise(resolve => setTimeout(resolve));
}
