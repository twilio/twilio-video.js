'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const sinon = require('sinon');

const PeerConnectionV2 = require('../../../../../lib/signaling/v2/peerconnection');
const { MediaClientLocalDescFailedError, MediaClientRemoteDescFailedError } = require('../../../../../lib/util/twilio-video-errors');
const { FakeMediaStream, FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const { a, combinationContext } = require('../../../../lib/util');

describe('PeerConnectionV2', () => {
  describe('constructor', () => {
    it('sets .id', function() {
      const test = makeTest();
      assert.equal(test.pcv2.id, test.id);
    });
  });

  describe('#addMediaStream', () => {
    let test;
    let stream;
    let result;

    beforeEach(() => {
      test = makeTest();
      stream = {};
      result = test.pcv2.addMediaStream(stream);
    });

    it('returns undefined', () => {
      assert.equal(result);
    });

    it('calls addStream on the underlying RTCPeerConnection', () => {
      assert.deepEqual(test.pc.getLocalStreams(), [stream]);
    });
  });

  describe('#close', () => {
    context('in signaling state "closed"', () => {
      let test;
      let initialState;
      let result;

      beforeEach(() => {
        test = makeTest();
        test.pc.close = sinon.spy(test.pc.close);
        test.pcv2.close();

        initialState = test.pcv2.getState();
        result = test.pcv2.close();
      });

      it('returns undefined', () => {
        assert.equal(result);
      });

      it('does not call close on the underlying RTCPeerConnection', () => {
        assert(test.pc.close.calledOnce);
      });

      it('does not update the local description', () => {
        assert.deepEqual(test.pcv2.getState(), initialState);
      });
    });

    context('in signaling state "stable"', () => {
      let test;
      let description;
      let result;

      beforeEach(async () => {
        test = makeTest();
        test.pc.close = sinon.spy(test.pc.close);

        [ description, result ] = await Promise.all([
          new Promise(resolve => test.pcv2.once('description', resolve)),
          test.pcv2.close()
        ]);
      });

      it('returns undefined', () => {
        assert.equal(result);
      });

      it('calls close on the underlying RTCPeerConnection', () => {
        assert(test.pc.close.calledOnce);
      });

      it('sets the local description to a close description and increments the revision', () => {
        assert.deepEqual(test.pcv2.getState(), test.state().setDescription(makeClose(), 1));
      });

      it('emits a "description" event with the new local description', () => {
        assert.deepEqual(description, test.state().setDescription(makeClose(), 1));
      });
    });
  });

  describe('#getRemoteMediaStreamTracks', () => {
    it('returns the remote MediaStreamTracks of the underlying RTCPeerConnection', () => {
      const test = makeTest();
      const remoteStream = new FakeMediaStream();
      const remoteTracks = [
        new FakeMediaStreamTrack('audio'),
        new FakeMediaStreamTrack('video')
      ];

      remoteStream.addTrack(remoteTracks[0]);
      remoteStream.addTrack(remoteTracks[1]);
      test.pc.getRemoteStreams = () => [ remoteStream ];
      assert.deepEqual(test.pcv2.getRemoteMediaStreamTracks(), remoteTracks);
    });
  });

  describe('#getState', () => {
    let test;

    beforeEach(() => {
      test = makeTest({ offers: 1, answers: 1 });
    });

    context('before setting a local description', () => {
      it('returns null', () => {
        assert.equal(test.pcv2.getState(), null);
      });
    });

    context('after setting a local', () => {
      context('answer description', () => {
        context('with #update', () => {
          beforeEach(async () => {
            const offer = makeOffer();
            const offerDescription = test.state().setDescription(offer, 1);
            await test.pcv2.update(offerDescription);
          });

          it('returns the local description', () => {
            assert.deepEqual(
              test.pcv2.getState(),
              test.state().setDescription(test.answers[0], 1));
          });
        });
      });

      context('close description', () => {
        context('with #close', () => {
          beforeEach(() => {
            test.pcv2.close();
          });

          it('returns the local description', () => {
            assert.deepEqual(
              test.pcv2.getState(),
              test.state().setDescription(makeClose(), 1));
          });
        });
      });

      context('offer description', () => {
        context('with #offer', () => {
          beforeEach(async () => {
            await test.pcv2.offer();
          });

          it('returns the local description', () => {
            assert.deepEqual(
              test.pcv2.getState(),
              test.state().setDescription(test.offers[0], 1));
          });
        });

        context('with #update', () => {
          beforeEach(async () => {
            const createOffer = makeCreateOffer();
            const createOfferDescription = test.state().setDescription(createOffer, 1);
            await test.pcv2.update(createOfferDescription);
          });

          it('returns the local description', () => {
            assert.deepEqual(
              test.pcv2.getState(),
              test.state().setDescription(test.offers[0], 2));
          });
        });
      });
    });
  });

  describe('#offer', () => {
    let test;
    let description;
    let result;

    beforeEach(async () => {
      test = makeTest({ offers: 2 });

      [ description, result ] = await Promise.all([
        new Promise(resolve => test.pcv2.once('description', resolve)),
        test.pcv2.offer()
      ]);
    });

    it('returns a Promise for undefined', () => {
      assert.equal(result);
    });

    it('calls createOffer and setLocalDescription on the underlying RTCPeerConnection', () => {
      assert.equal(test.pc.localDescription, test.offers[0]);
    });

    it('sets the local description to an offer description and increments the revision', async () => {
      assert.deepEqual(
        test.pcv2.getState(),
        test.state().setDescription(test.offers[0], 1));

      // NOTE: Test a subsequent call to offer, too.
      await test.pcv2.offer();
      assert.deepEqual(
        test.pcv2.getState(),
        test.state().setDescription(test.offers[1], 2));
    });

    it('emits a "description" event with the new local description', () => {
      assert.deepEqual(
        description,
        test.state().setDescription(test.offers[0], 1));
    });

    // TODO(mroberts): Would be nice to somehow consolidate this with the
    // `beforeEach` call (or move it out).
    ['createOffer', 'setLocalDescription'].forEach(scenario => {
      context(`when ${scenario} on the underlying RTCPeerConnection fails`, () => {
        it('should throw a MediaClientLocalDescFailedError', async () => {
          const test = makeTest({ offers: 1, errorScenario: scenario });
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

  describe('#removeMediaStream', () => {
    let test;
    let mediaStream;
    let result;

    beforeEach(() => {
      test = makeTest();
      mediaStream = {};
      test.pcv2.addMediaStream(mediaStream);
      result = test.pcv2.removeMediaStream(mediaStream);
    });

    it('returns undefined', () => {
      assert.equal(result);
    });

    it('calls removeStream on the underlying RTCPeerConnection', () => {
      assert.deepEqual(test.pc.getLocalStreams(), []);
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
        test.pc.setConfiguration = _configuration => configuration = _configuration;

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

  // NOTE(mroberts): Eventually, these tests for `update` will replace the
  // "older" ones below.
  describe('#update, called', () => {
    combinationContext([
      [
        [
          'before',
          'after'
        ],
        x => `${x} the initial round of negotiation`
      ],
      [
        [
          'stable',
          'have-local-offer',
          'closed'
        ],
        x => `in signalingState "${x}"`
      ],
      [
        [
          'offer',
          'answer',
          'create-offer',
          'close'
        ],
        x => `with ${a(x)} "${x}" description`
      ],
      [
        [
          'newer',
          'equal',
          'older'
        ],
        x => `at ${a(x)} ${x} revision`
      ]
    ], ([
      beforeOrAfter,
      signalingState,
      type,
      newerEqualOrOlder
    ]) => {
      let test;
      let stateBefore;
      let signalingStateBefore;
      let result;

      beforeEach(async () => {
        test = makeTest({ offers: 10, answers: 10 });
        let rev = 1;

        if (beforeOrAfter === 'after') {
          await test.pcv2.offer();
          const answer = makeAnswer();
          const answerDescription = test.state().setDescription(answer, rev);
          await test.pcv2.update(answerDescription);
          if (signalingState !== 'stable' || (signalingState === 'stable' && type === 'close')) {
            rev++;
          }
        }

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

        switch (newerEqualOrOlder) {
          case 'newer':
            rev++;
            break;
          case 'equal':
            break;
          default: // 'older'
            rev--;
            break;
        }

        let desc;
        switch (type) {
          case 'offer':
            const offer = makeOffer();
            desc = test.state().setDescription(offer, rev);
            break;
          case 'answer':
            const answer = makeAnswer();
            desc = test.state().setDescription(answer, rev);
            break;
          case 'create-offer':
            const createOffer = makeCreateOffer();
            desc = test.state().setDescription(createOffer, rev);
            break;
          default: // 'close'
            const close = makeClose();
            desc = test.state().setDescription(close, rev);
            break;
        }

        stateBefore = test.pcv2.getState();
        signalingStateBefore = test.pc.signalingState;
        result = await test.pcv2.update(desc);
      });

      it('returns a Promise that resolves to undefined', () => {
        assert.equal(result);
      });

      let newState = false;
      let newSignalingState = false;
      if (signalingState !== 'closed') {
        switch (type) {
          case 'offer':
            if (// Skip ahead.
                signalingState === 'stable' && newerEqualOrOlder === 'newer' ||
                // Glare.
                signalingState === 'have-local-offer' && (newerEqualOrOlder === 'newer' || newerEqualOrOlder === 'equal') ||
                // Initial offer.
                signalingState === 'stable' && newerEqualOrOlder === 'equal' && beforeOrAfter === 'before') {
              newState = true;
            }
            break;
          case 'answer':
            if (// Matching answer.
                signalingState === 'have-local-offer' && newerEqualOrOlder === 'equal') {
              newSignalingState = 'stable';
            }
            break;
          case 'create-offer':
            if (// Skip ahead.
                signalingState === 'stable' && newerEqualOrOlder === 'newer' ||
                // Initial create-offer.
                signalingState === 'stable' && newerEqualOrOlder === 'equal' && beforeOrAfter === 'before') {
              newState = true;
              newSignalingState = 'have-local-offer';
            }
            break;
          default: // 'close'
            // Terminal state.
            if (newerEqualOrOlder !== 'older') {
              newSignalingState = 'closed';
            }
            break;
        }
      }

      if (newState) {
        it('changes the PeerConnectionV2\'s state', () => {
          // TODO(mroberts): Compare to a new, computed state instead?
          try {
            assert.deepEqual(test.pcv2.getState(), stateBefore);
          } catch (error) {
            return;
          }

          throw new Error('PeerConnectionV2\'s state was unchanged');
        });
      } else {
        it('does not change the PeerConnectionV2\'s state', () => {
          assert.deepEqual(test.pcv2.getState(), stateBefore);
        });
      }

      if (newSignalingState) {
        it('changes the underlying RTCPeerConnection\'s signalingState', () => {
          assert.equal(test.pc.signalingState, newSignalingState);
        });
      } else {
        it('does not change the underlying RTCPeerConnection\'s signalingState', () => {
          assert.equal(test.pc.signalingState, signalingStateBefore);
        });
      }
    });
  });

  describe('#update', () => {
    context('called with', () => {
      let test;

      beforeEach(() => {
        test = makeTest({ offers: 2, answers: 1 });
        test.pc.addIceCandidate = sinon.spy(test.pc.addIceCandidate);
        test.pc.close = sinon.spy(test.pc.close);
        test.pc.setLocalDescription = sinon.spy(test.pc.setLocalDescription);
        test.pc.setRemoteDescription = sinon.spy(test.pc.setRemoteDescription);
      });

      context('an answer description at', () => {
        context('a new revision', () => {
          beforeEach(async () => {
            await test.pcv2.offer();

            const answerDescription = test.state().setDescription(makeAnswer(), 2);
            await test.pcv2.update(answerDescription);
          });

          it('does nothing', () => {
            sinon.assert.notCalled(test.pc.setRemoteDescription);
          });
        });

        context('the same revision', () => {
          context('in signaling state "closed"', () => {
            beforeEach(async () => {
              const closeDescription = test.state().setDescription(makeClose(), 1);
              await test.pcv2.update(closeDescription);

              const answerDescription = test.state().setDescription(makeAnswer(), 1);
              await test.pcv2.update(answerDescription);
            });

            it('does nothing', () => {
              sinon.assert.notCalled(test.pc.setRemoteDescription);
            });
          });

          context('in signaling state "have-local-offer"', () => {
            let before;
            let answer;

            beforeEach(async () => {
              const candidates = test.state().setIce(makeIce('bar', 1));
              await test.pcv2.update(candidates);

              await test.pcv2.offer();
              before = test.pcv2.getState();

              answer = makeAnswer({ ufrag: 'bar' });
              const answerDescription = test.state().setDescription(answer, 1);
              await test.pcv2.update(answerDescription);
            });

            it('calls setRemoteDescription with the answer description on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.remoteDescription,
                Object.assign({ revision: 1 }, answer));
            });

            // TODO(mroberts): Would be nice to somehow consolidate this with
            // the `beforeEach` call (or move it out).
            context('when setRemoteDescription on the underlying RTCPeerConnection fails', () => {
              let test;
              let answerDescription;

              beforeEach(async () => {
                test = makeTest({ offers: 1, errorScenario: 'setRemoteDescription' });

                await test.pcv2.offer();

                const answer = makeAnswer();
                answerDescription = test.state().setDescription(answer, 1);
              });

              it('should throw a MediaClientRemoteDescFaileError', async () => {
                try {
                  await test.pcv2.update(answerDescription);
                } catch (error) {
                  assert(error instanceof MediaClientRemoteDescFailedError);
                  assert.equal(error.code, 53402);
                  return;
                }

                throw new Error('Unexpected resolution');
              });
            });

            it('calls addIceCandidate with any previously-received matching ICE candidates on the underlying RTCPeerConnection', () => {
              sinon.assert.calledOnce(test.pc.addIceCandidate);
              sinon.assert.calledWith(test.pc.addIceCandidate, sinon.match({ candidate: 'candidate1' }));
            });

            it('does not update the local description', () => {
              assert.deepEqual(test.pcv2.getState(), before);
            });
          });

          context('in signaling state "stable"', () => {
            beforeEach(async () => {
              await test.pcv2.offer();

              const answer = makeAnswer();
              const answerDescription = test.state().setDescription(answer, 1);
              await test.pcv2.update(answerDescription);
              await test.pcv2.update(answerDescription);
            });

            it('does nothing', () => {
              assert(test.pc.setRemoteDescription.calledOnce);
            });
          });
        });

        context('an old revision', () => {
          beforeEach(async () => {
            await test.pcv2.offer();
            await test.pcv2.update(test.state().setDescription(makeAnswer(), 0));
          });

          it('does nothing', () => {
            assert(!test.pc.setRemoteDescription.calledOnce);
          });
        });
      });

      context('a close description at', () => {
        context('a new revision', () => {
          context('in signaling state "closed"', () => {
            beforeEach(async () => {
              const close = makeClose();
              const closeDescription1 = test.state().setDescription(close, 1);
              await test.pcv2.update(closeDescription1);

              const closeDescription2 = test.state().setDescription(close, 2);
              await test.pcv2.update(closeDescription2);
            });

            it('does nothing', () => {
              sinon.assert.calledOnce(test.pc.close);
            });
          });

          context('in signaling state "have-local-offer"', () => {
            let before;

            beforeEach(async () => {
              await test.pcv2.offer();

              before = test.pcv2.getState();

              const close = makeClose();
              const closeDescription = test.state().setDescription(close, 2);
              await test.pcv2.update(closeDescription);
            });

            it('calls close on the underlying RTCPeerConnection', () => {
              sinon.assert.calledOnce(test.pc.close);
            });

            it('does not update the local description', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                before);
            });
          });

          context('in signaling state "stable"', () => {
            let before;

            beforeEach(async () => {
              before = test.pcv2.getState();

              const close = makeClose();
              const closeDescription = test.state().setDescription(close, 1);
              await test.pcv2.update(closeDescription);
            });

            it('calls close on the underlying RTCPeerConnection', () => {
              sinon.assert.calledOnce(test.pc.close);
            });

            it('does not update the local description', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                before);
            });
          });
        });

        context('the same revision', () => {
          context('in signaling state "closed"', () => {
            beforeEach(async () => {
              const close = makeClose();
              const closeDescription = test.state().setDescription(close, 1);
              await test.pcv2.update(closeDescription);
              await test.pcv2.update(closeDescription);
            });

            it('does nothing', () => {
              sinon.assert.calledOnce(test.pc.close);
            });
          });

          context('in signaling state "have-local-offer"', () => {
            let before;

            beforeEach(async () => {
              await test.pcv2.offer();

              before = test.pcv2.getState();

              const close = makeClose();
              const closeDescription = test.state().setDescription(close, 1);
              await test.pcv2.update(closeDescription);
            });

            it('calls close on the underlying RTCPeerConnection', () => {
              sinon.assert.calledOnce(test.pc.close);
            });

            it('does not update the local description', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                before);
            });
          });

          context('in signaling state "stable"', () => {
            beforeEach(async () => {
              await test.pcv2.offer();

              const answer = makeAnswer();
              const answerDescription = test.state().setDescription(answer, 1);
              await test.pcv2.update(answerDescription);

              const close = makeClose();
              const closeDescription = test.state().setDescription(close, 1);
              await test.pcv2.update(closeDescription);
            });

            it('does nothing', () => {
              sinon.assert.notCalled(test.pc.close);
            });
          });
        });

        context('an old revision', () => {
          beforeEach(async () => {
            await test.pcv2.offer();

            const close = makeClose();
            const closeDescription = test.state().setDescription(close, 0);
            await test.pcv2.update(closeDescription);
          });

          it('does nothing', () => {
            sinon.assert.notCalled(test.pc.close);
          });
        });
      });

      context('a create-offer description at', () => {
        context('a new revision', () => {
          context('in signaling state "closed"', () => {
            let before;

            beforeEach(async () => {
              const close = makeClose();
              const closeDescription = test.state().setDescription(close, 1);
              await test.pcv2.update(closeDescription);

              before = test.pcv2.getState();

              const createOffer = makeCreateOffer();
              const createOfferDescription = test.state().setDescription(createOffer, 2);
              await test.pcv2.update(createOfferDescription);
            });

            it('does nothing', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                before);
            });
          });

          context('in signaling state "stable"', () => {
            let offer;
            let result;

            beforeEach(async () => {
              const createOffer = makeCreateOffer();
              const createOfferDescription = test.state().setDescription(createOffer, 1);

              const resultPromise = test.pcv2.update(createOfferDescription);
              offer = await new Promise(resolve => test.pcv2.once('description', resolve));
              await resultPromise;
            });

            it('calls createOffer and setLocalDescription on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.localDescription,
                test.offers[0]);
            });

            // TODO(mroberts): Would be nice to somehow consolidate this with
            // the `beforeEach` call (or move it out).
            ['createOffer', 'setLocalDescription'].forEach(scenario => {
              context(`when ${scenario} on the underlying RTCPeerConnection fails`, () => {
                it('should throw a MediaClientLocalDescFailedError', async () => {
                  const test = makeTest({ offers: 1, errorScenario: scenario });

                  const createOffer = makeCreateOffer();
                  const createOfferDescription = test.state().setDescription(createOffer, 1);
                  try {
                    await test.pcv2.update(createOfferDescription);
                  } catch (error) {
                    assert(error instanceof MediaClientLocalDescFailedError);
                    assert.equal(error.code, 53400);
                    return;
                  }

                  throw new Error('Unexpected resolution');
                });
              });
            });

            it('sets the local description to an offer description and increments the revision', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                test.state().setDescription(test.offers[0], 2));
            });

            it('emits a "description" event with the new local description', () => {
              assert.deepEqual(
                offer,
                test.state().setDescription(test.offers[0], 2));
            });
          });

          context('in signaling state "have-local-offer"', () => {
            let before;

            beforeEach(async () => {
              await test.pcv2.offer();

              before = test.pcv2.getState();

              const createOffer = makeCreateOffer();
              const createOfferDescription = test.state().setDescription(createOffer, 2);
              await test.pcv2.update(createOfferDescription);
            });

            it('does nothing', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                before);
            });
          });
        });

        context('the same revision', () => {
          let before;

          beforeEach(async () => {
            await test.pcv2.offer();

            before = test.pcv2.getState();

            const createOffer = makeCreateOffer();
            const createOfferDescription = test.state().setDescription(createOffer, 1);
            await test.pcv2.update(createOfferDescription);
          });

          it('does nothing', () => {
            assert.deepEqual(
              test.pcv2.getState(),
              before);
          });
        });

        context('an old revision', () => {
          let before;

          beforeEach(async () => {
            await test.pcv2.offer();

            before = test.pcv2.getState();

            const createOffer = makeCreateOffer();
            const createOfferDescription = test.state().setDescription(createOffer, 1);
            await test.pcv2.update(createOfferDescription);
          });

          it('does nothing', () => {
            assert.deepEqual(
              test.pcv2.getState(),
              before);
          });
        });
      });

      context('an offer description at', () => {
        context('a new revision', () => {
          context('in signaling state "closed"', () => {
            let before;

            beforeEach(async () => {
              const close = makeClose();
              const closeDescription = test.state().setDescription(close, 1);
              await test.pcv2.update(closeDescription);

              before = test.pcv2.getState();

              const offer = makeOffer();
              const offerDescription = test.state().setDescription(offer, 2);
              await test.pcv2.update(offerDescription);
            });

            it('does nothing', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                before);
            });
          });

          context('in signaling state "have-local-offer" (glare)', () => {
            let offer;
            let answer;
            let newOffer;
            let result;

            beforeEach(async () => {
              test.pc.setLocalDescription = sinon.spy(test.pc.setLocalDescription);

              await test.pcv2.offer();

              offer = makeOffer();
              const offerDescription = test.state().setDescription(offer, 2);

              const resultPromise = test.pcv2.update(offerDescription);
              answer = await new Promise(resolve => test.pcv2.once('description', resolve));
              newOffer = await new Promise(resolve => test.pcv2.once('description', resolve));
              result = await resultPromise;
            });

            it('calls setLocalDescription with a rollback description on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.setLocalDescription.args[1][0],
                { type: 'rollback' });
            });

            it('calls setRemoteDescription with the offer description on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.remoteDescription,
                Object.assign({ revision: 2 }, offer));
            });

            it('calls createAnswer and setLocalDescription on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.setLocalDescription.args[2][0],
                test.answers[0]);
            });

            it('calls createOffer and setLocalDescription on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.setLocalDescription.args[3][0],
                test.offers[1]);
            });

            it('sets the local description to an offer description and increments the revision', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                test.state().setDescription(test.offers[1], 3));
            });

            it('emits two "description" events: first an answer description, then an offer description', () => {
              assert.deepEqual(
                answer,
                test.state().setDescription(test.answers[0], 2));

              assert.deepEqual(
                newOffer,
                test.state().setDescription(test.offers[1], 3));
            });

            // TODO(mroberts): Would be nice to somehow consolidate this with
            // the `beforeEach` call (or move it out).
            ['createOffer', 'createAnswer', 'setLocalDescription', 'setRemoteDescription'].forEach(scenario => {
              context(`when ${scenario} on the underlying RTCPeerConnection fails`, () => {
                const expectedError = scenario === 'setRemoteDescription'
                  ? 'MediaClientRemoteDescFailedError'
                  : 'MediaClientLocalDescFailedError';

                const expectedErrorClass = scenario === 'setRemoteDescription'
                  ? MediaClientRemoteDescFailedError
                  : MediaClientLocalDescFailedError;

                const expectedErrorCode = scenario === 'setRemoteDescription'
                  ? 53402
                  : 53400;

                it(`should throw a ${expectedError}`, async () => {
                  const test = makeTest({ offers: 2, answers: 1, errorScenario: scenario });

                  const offer = makeOffer();
                  const offerDescription = test.state().setDescription(offer, 2);
                  try {
                    await test.pcv2.offer();
                    await test.pcv2.update(offerDescription);
                  } catch(error) {
                    assert(error instanceof expectedErrorClass);
                    assert.equal(error.code, expectedErrorCode);
                    return;
                  }

                  throw new Error('Unexpected resolution');
                });
              });
            });
          });

          context('in signaling state "stable"', () => {
            let offer;
            let answer;
            let result;

            beforeEach(async () => {
              offer = makeOffer({ ufrag: 'foo' });
              const offerDescription = test.state().setDescription(offer, 1);

              const candidates = test.state().setIce(makeIce('foo', 1));
              await test.pcv2.update(candidates);

              const resultPromise = test.pcv2.update(offerDescription);
              answer = await new Promise(resolve => test.pcv2.once('description', resolve));
              result = await resultPromise;
            });

            it('calls setRemoteDescription with the offer description on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.remoteDescription,
                Object.assign({ revision: 1 }, offer));
            });

            it('calls createAnswer and setLocalDescription on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.localDescription,
                test.answers[0]);
            });

            it('calls addIceCandidate with any previously-received matching ICE candidates on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.addIceCandidate.args[0][0],
                { candidate: 'candidate1' });
            });

            it('sets the local description to an answer description at the new revision', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                test.state().setDescription(test.answers[0], 1));
            });

            it('emits a "description" event with the new local description', () => {
              assert.deepEqual(
                answer,
                test.state().setDescription(test.answers[0], 1));
            });

            // TODO(mroberts): Would be nice to somehow consolidate this with
            // the `beforeEach` call (or move it out).
            ['createAnswer', 'setLocalDescription', 'setRemoteDescription'].forEach(scenario => {
              context(`when ${scenario} on the underlying RTCPeerConnection fails`, () => {
                const expectedError = scenario === 'setRemoteDescription'
                  ? 'MediaClientRemoteDescFailedError'
                  : 'MediaClientLocalDescFailedError';

                const expectedErrorClass = scenario === 'setRemoteDescription'
                  ? MediaClientRemoteDescFailedError
                  : MediaClientLocalDescFailedError;

                const expectedErrorCode = scenario === 'setRemoteDescription'
                  ? 53402
                  : 53400;

                it(`should throw a ${expectedError}`, async () => {
                  const test = makeTest({ answers: 1, errorScenario: scenario });

                  const offer = makeOffer();
                  const offerDescription = test.state().setDescription(offer, 1);
                  try {
                    await test.pcv2.update(offerDescription);
                  } catch (error) {
                    assert(error instanceof expectedErrorClass);
                    assert.equal(error.code, expectedErrorCode);
                    return;
                  }

                  throw new Error('Unexpected resolution');
                });
              });
            });
          });
        });

        context('the same revision', () => {
          context('in signaling state "closed"', () => {
            let before;

            beforeEach(async () => {
              const close = makeClose();
              const closeDescription = test.state().setDescription(close, 1);
              await test.pcv2.update(closeDescription);

              before = test.pcv2.getState();

              const offer = makeOffer();
              const offerDescription = test.state().setDescription(offer, 1);
              await test.pcv2.update(offerDescription);
            });

            it('does nothing', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                before);
            });
          });

          context('in signaling state "have-local-offer" (glare)', () => {
            let offer;
            let answer;
            let newOffer;
            let result;

            beforeEach(async () => {
              offer = makeOffer();
              const offerDescription = test.state().setDescription(offer, 1);

              await test.pcv2.offer();

              const resultPromise = test.pcv2.update(offerDescription);
              answer = await new Promise(resolve => test.pcv2.once('description', resolve));
              newOffer = await new Promise(resolve => test.pcv2.once('description', resolve));
              result = await resultPromise;
            });

            it('calls setLocalDescription with a rollback description on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.setLocalDescription.args[1][0],
                { type: 'rollback' });
            });

            it('calls setRemoteDescription with the offer description on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.remoteDescription,
                Object.assign({ revision: 1 }, offer));
            });

            it('calls createAnswer and setLocalDescription on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.setLocalDescription.args[2][0],
                test.answers[0]);
            });

            it('calls createOffer and setLocalDescription on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.setLocalDescription.args[3][0],
                test.offers[1]);
            });

            it('sets the local description to an offer description and increments the revision', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                test.state().setDescription(test.offers[1], 2));
            });

            it('emits a "description" event with the new local description', () => {
              assert.deepEqual(
                answer,
                test.state().setDescription(test.answers[0], 1));

              assert.deepEqual(
                newOffer,
                test.state().setDescription(test.offers[1], 2));
            });

            // TODO(mroberts): Would be nice to somehow consolidate this with
            // the `beforeEach` call (or move it out).
            ['createOffer', 'createAnswer', 'setLocalDescription', 'setRemoteDescription'].forEach(scenario => {
              context(`when ${scenario} on the underlying RTCPeerConnection fails`, () => {
                const expectedError = scenario === 'setRemoteDescription'
                  ? 'MediaClientRemoteDescFailedError'
                  : 'MediaClientLocalDescFailedError';

                const expectedErrorClass = scenario === 'setRemoteDescription'
                  ? MediaClientRemoteDescFailedError
                  : MediaClientLocalDescFailedError;

                const expectedErrorCode = scenario === 'setRemoteDescription'
                  ? 53402
                  : 53400;

                it(`should throw a ${expectedError}`, async () => {
                  const test = makeTest({ offers: 2, answers: 1, errorScenario: scenario });

                  const offer = makeOffer();
                  const offerDescription = test.state().setDescription(offer, 1);
                  try {
                    await test.pcv2.offer();
                    await test.pcv2.update(offerDescription);
                  } catch (error) {
                    assert(error instanceof expectedErrorClass);
                    assert.equal(error.code, expectedErrorCode);
                    return;
                  }

                  throw new Error('Unexpected resolution');
                });
              });
            });
          });

          context('in signaling state "stable"', () => {
            let before;

            beforeEach(async () => {
              await test.pcv2.offer();

              const answer = makeAnswer();
              const answerDescription = test.state().setDescription(answer, 1);
              await test.pcv2.update(answerDescription);

              before = test.pcv2.getState();

              const offer = makeOffer();
              const offerDescription = test.state().setDescription(offer, 1);
              await test.pcv2.update(offerDescription);
            });

            it('does nothing', () => {
              assert.deepEqual(
                test.pcv2.getState(),
                before);
            });
          });
        });

        context('an old revision', () => {
          let before;

          beforeEach(async () => {
            await test.pcv2.offer();

            const answer = makeAnswer();
            const answerDescription = test.state().setDescription(answer, 1);
            await test.pcv2.update(answerDescription);

            before = test.pcv2.getState();

            const offer = makeOffer();
            const offerDescription = test.state().setDescription(offer, 1);
            await test.pcv2.update(offerDescription);
          });

          it('does nothing', () => {
            assert.deepEqual(
              test.pcv2.getState(),
              before);
          });
        });
      });
    });

    context('called with candidates', () => {
      let test;

      beforeEach(() => {
        test = makeTest({ offers: 1, answers: 1 });
        test.pc.addIceCandidate = sinon.spy(test.pc.addIceCandidate);
      });

      context('whose username fragment matches that of the current remote', () => {
        context('answer description', () => {
          beforeEach(async () => {
            await test.pcv2.offer();
            await test.pcv2.update(test.state().setDescription(makeAnswer({ ufrag: 'bar' }), 1));
            await test.pcv2.update(test.state().setIce(makeIce('bar', 1)));
            assert.deepEqual(
              test.pc.addIceCandidate.args[0][0],
              { candidate: 'candidate1' });
          });

          context('at a new revision', () => {
            beforeEach(async () => {
              await test.pcv2.update(test.state().setIce(makeIce('bar', 2)));
            });

            it('calls addIceCandidate with any new ICE candidates on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.addIceCandidate.args[1][0],
                { candidate: 'candidate2' });
            });
          });

          context('at the same revision', () => {
            beforeEach(async () => {
              await test.pcv2.update(test.state().setIce(makeIce('bar', 1)));
            });

            it('does nothing', () => {
              sinon.assert.calledOnce(test.pc.addIceCandidate);
            });
          });

          context('at an old revision', () => {
            beforeEach(async () => {
              await test.pcv2.update(test.state().setIce(makeIce('bar', 0)));
            });

            it('does nothing', () => {
              sinon.assert.calledOnce(test.pc.addIceCandidate);
            });
          });
        });

        context('offer description', () => {
          beforeEach(async () => {
            await test.pcv2.update(test.state().setDescription(makeOffer({ ufrag: 'foo' }), 2));
            await test.pcv2.update(test.state().setIce(makeIce('foo', 1)));
            assert.deepEqual(
              test.pc.addIceCandidate.args[0][0],
              { candidate: 'candidate1' });
          });

          context('at a new revision', () => {
            beforeEach(async () => {
              await test.pcv2.update(test.state().setIce(makeIce('foo', 2)));
            });

            it('calls addIceCandidate with any new ICE candidates on the underlying RTCPeerConnection', () => {
              assert.deepEqual(
                test.pc.addIceCandidate.args[1][0],
                { candidate: 'candidate2' });
            });
          });

          context('at the same revision', () => {
            beforeEach(async () => {
              await test.pcv2.update(test.state().setIce(makeIce('foo', 1)));
            });

            it('does nothing', () => {
              sinon.assert.calledOnce(test.pc.addIceCandidate);
            });
          });

          context('at an old revision', () => {
            beforeEach(async () => {
              await test.pcv2.update(test.state().setIce(makeIce('foo', 0)));
            });

            it('does nothing', () => {
              sinon.assert.calledOnce(test.pc.addIceCandidate);
            });
          });
        });
      });

      context('whose username fragment does not match that of the current remote', () => {
        context('answer description', () => {
          beforeEach(async () => {
            await test.pcv2.offer();
            await test.pcv2.update(test.state().setDescription(makeAnswer({ ufrag: 'fizz' }), 1));
            await test.pcv2.update(test.state().setIce(makeIce('buzz', 1)));
          });

          context('at a new revision', () => {
            it('does nothing', () => {
              sinon.assert.notCalled(test.pc.addIceCandidate);
            });
          });

          context('at the same revision', () => {
            beforeEach(async () => {
              await test.pcv2.update(test.state().setIce(makeIce('buzz', 1)));
            });

            it('does nothing', () => {
              sinon.assert.notCalled(test.pc.addIceCandidate);
            });
          });

          context('at an old revision', () => {
            beforeEach(async () => {
              await test.pcv2.update(test.state().setIce(makeIce('buzz', 0)));
            });

            it('does nothing', () => {
              sinon.assert.notCalled(test.pc.addIceCandidate);
            });
          });
        });

        context('offer description', () => {
          beforeEach(async () => {
            await test.pcv2.update(test.state().setDescription(makeOffer({ ufrag: 'fizz' }), 1));
            await test.pcv2.update(test.state().setIce(makeIce('buzz', 1)));
          });

          context('at a new revision', () => {
            it('does nothing', () => {
              sinon.assert.notCalled(test.pc.addIceCandidate);
            });
          });

          context('at the same revision', () => {
            beforeEach(async () => {
              await test.pcv2.update(test.state().setIce(makeIce('buzz', 1)));
            });

            it('does nothing', () => {
              sinon.assert.notCalled(test.pc.addIceCandidate);
            });
          });

          context('at an old revision', () => {
            beforeEach(async () => {
              await test.pcv2.update(test.state().setIce(makeIce('buzz', 0)));
            });

            it('does nothing', () => {
              sinon.assert.notCalled(test.pc.addIceCandidate);
            });
          });
        });
      });
    });
  });

  describe('"candidates" event', () => {
    let test;

    beforeEach(async () => {
      test = makeTest({ offers: [makeOffer({ ufrag: 'foo' })] });
      await test.pcv2.offer();
    });

    context('when the underlying RTCPeerConnection\'s "icecandidate" event fires with an initial candidate for the current username fragment', () => {
      let iceState;

      beforeEach(async () => {
        const iceStatePromise = new Promise(resolve => test.pcv2.once('candidates', resolve));

        test.pc.emit('icecandidate', {
          type: 'icecandidate',
          candidate: { candidate: 'candidate1' }
        });

        iceState = await iceStatePromise;
      });

      it('emits the event with a single-element list of ICE candidates', () => {
        assert.deepEqual(
          iceState,
          test.state().setIce(makeIce('foo', 1)));
      });
    });

    context('when the underlying RTCPeerConnection\'s "icecandidate" event fires with subsequent candidates for the current username fragment', () => {
      let iceState;

      beforeEach(async () => {
        test.pc.emit('icecandidate', {
          type: 'icecandidate',
          candidate: { candidate: 'candidate1' }
        });

        const iceStatePromise = new Promise(resolve => test.pcv2.once('candidates', resolve));

        test.pc.emit('icecandidate', {
          type: 'icecandidate',
          candidate: { candidate: 'candidate2' }
        });

        iceState = await iceStatePromise;
      });

      it('emits the event with the full list of ICE candidates gathered up to that point', () => {
        assert.deepEqual(
          iceState,
          test.state().setIce(makeIce('foo', 2)));
      });
    });

    context('when the underlying RTCPeerConnection\'s "icecandidate" fires without a candidate (ICE gathering completed)', () => {
      let iceState;

      beforeEach(async () => {
        test.pc.emit('icecandidate', {
          type: 'icecandidate',
          candidate: { candidate: 'candidate1' }
        });

        test.pc.emit('icecandidate', {
          type: 'icecandidate',
          candidate: { candidate: 'candidate2' }
        });

        const iceStatePromise = new Promise(resolve => test.pcv2.once('candidates', resolve));

        test.pc.emit('icecandidate', {
          type: 'icecandidate',
          candidate: null
        });

        iceState = await iceStatePromise;
      });

      it('emits the event with the full list of ICE candidates gathered up to that point', () => {
        const endOfCandidatesIceState = test.state().setIce(makeIce('foo', 2));
        endOfCandidatesIceState.ice.complete = true;
        endOfCandidatesIceState.ice.revision = 3;

        assert.deepEqual(
          iceState,
          endOfCandidatesIceState);
      });
    });
  });

  describe('"trackAdded" event', () => {
    context('when "track" events are supported by the underlying RTCPeerConnection', () => {
      let test;
      let mediaStreamTrack;
      let track;

      beforeEach(async () => {
        const pc = makePeerConnection();

        function RTCPeerConnection() {
          return pc;
        }

        RTCPeerConnection.prototype.ontrack = null;

        test = makeTest({
          RTCPeerConnection: RTCPeerConnection
        });

        mediaStreamTrack = { id: '456' };
        const mediaStream = { id: 'abc' };

        const trackPromise = new Promise(resolve => test.pcv2.once('trackAdded', resolve));

        pc.emit('track', {
          type: 'track',
          track: mediaStreamTrack,
          streams: [mediaStream]
        });

        track = await trackPromise;
      });
      
      it('emits the "trackAdded" event directly from the underlying RTCPeerConnection\'s "track" event handler', () => {
        assert.equal(mediaStreamTrack, track);
      });
    });
  });
});

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

  options.offers = options.offers.map(description => description instanceof Description
    ? description : new Description(description));

  options.answers = options.answers.map(description => description instanceof Description
    ? description : new Description(description));

  let offerIndex = 0;
  let answerIndex = 0;

  const pc = new EventEmitter();

  const localStreams = [];
  const remoteStreams = [];

  pc.signalingState = 'stable';
  pc.localDescription = null;
  pc.remoteDescription = null;

  pc.addEventListener = pc.addListener;
  pc.removeEventListener = pc.removeListener;
  pc.dispatchEvent = event => {
    pc.emit(event.type, event);
  };

  pc.setLocalDescription = description => {
    if (options.errorScenario === 'setLocalDescription') {
      return Promise.reject(new Error('Testing setLocalDescription error'));
    }
    if (pc.signalingState === 'stable' &&
        description.type === 'offer') {
      pc.signalingState = 'have-local-offer';
      pc.emit('signalingstatechange');
    } else if (pc.signalingState === 'have-remote-offer' &&
               (description.type === 'answer' || description.type === 'rollback')) {
      pc.signalingState = 'stable';
      pc.emit('signalingstatechange');
    }
    pc.localDescription = description;
    return Promise.resolve();
  };

  pc.setRemoteDescription = description => {
    if (options.errorScenario === 'setRemoteDescription') {
      return Promise.reject(new Error('Testing setRemoteDescription error'));
    }
    if (pc.signalingState === 'stable' &&
        description.type === 'offer') {
      pc.signalingState = 'have-remote-offer';
      pc.emit('signalingstatechanged');
    } else if (pc.signalingState === 'have-local-offer' &&
               (description.type === 'answer' || description.type === 'rollback')) {
      pc.signalingState = 'stable';
      pc.emit('signalingstatechange');
    }
    pc.remoteDescription = description;
    return Promise.resolve();
  };

  pc.createOffer = () => {
    if (options.errorScenario === 'createOffer') {
      return Promise.reject(new Error('Testing createOffer error'));
    }

    const offer = options.offers[offerIndex++];
    if (offer) {
      return Promise.resolve(offer);
    }
    return Promise.reject(new Error('Ran out of offers'));
  };

  pc.createAnswer = () => {
    if (options.errorScenario === 'createAnswer') {
      return Promise.reject(new Error('Testing createAnswer error'));
    }

    const answer = options.answers[answerIndex++];
    if (answer) {
      return Promise.resolve(answer);
    }
    return Promise.reject(new Error('Ran out of answers'));
  };

  pc.close = () => {
    pc.signalingState = 'closed';
    pc.emit('signalingstatechange');
  };

  pc.addStream = stream => localStreams.push(stream);

  pc.removeStream = stream => {
    const i = localStreams.indexOf(stream);
    if (i > -1) {
      localStreams.splice(i);
    }
  };

  pc.getLocalStreams = () => localStreams;
  pc.getRemoteStreams = () => remoteStreams;

  pc.addIceCandidate = candidate => Promise.resolve();

  return pc;
}

function makeId() {
  return Math.floor(Math.random() * 100 + 0.5);
}

function identity(a) {
  return a;
}

function makePeerConnectionV2(options) {
  options = options || {};
  options.id = options.id || makeId();
  const pc = options.pc || makePeerConnection(options);
  function RTCPeerConnection() {
    return pc;
  }
  options.RTCPeerConnection = options.RTCPeerConnection || RTCPeerConnection;
  return new PeerConnectionV2(options.id, {
    Event: function(type) { return { type: type }; },
    RTCIceCandidate: identity,
    RTCPeerConnection: options.RTCPeerConnection,
    RTCSessionDescription: identity,
  });
}

function PeerConnectionStateBuilder(id) {
  this.id = id;
}

PeerConnectionStateBuilder.prototype.setDescription = function setDescription(description, revision) {
  this.description = Object.assign({
    revision: revision
  }, description);
  return this;
};

PeerConnectionStateBuilder.prototype.setIce = function setIce(ice) {
  this.ice = {
    candidates: ice.candidates.slice(),
    revision: ice.revision,
    ufrag: ice.ufrag
  };
  return this;
};

function Description(description) {
  Object.assign(this, description);
}

function makeDescription(type, options) {
  options = options || {};
  const description = {
    type: type
  };
  if (type === 'offer' ||
      type === 'answer' ||
      type === 'pranswer') {
    description.sdp = 'o=- ' + (Number.parseInt(Math.random() * 1000)) + '\r\n';
    if (options.ufrag) {
      description.sdp += 'a=ice-ufrag:' + options.ufrag + '\r\n';
    }
  }
  return new Description(description);
}

function makeClose() {
  return makeDescription('close');
}

function makeCreateOffer() {
  return makeDescription('create-offer');
}

function makeOffer(options) {
  return makeDescription('offer', options);
}

function makeAnswer(options) {
  return makeDescription('answer', options);
}

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
