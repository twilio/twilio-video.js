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
    let test;

    beforeEach(() => {
      test = makeTest();
    });

    it('sets .id', function() {
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
      test.pc.getRemoteStreams = () => [remoteStream];
      assert.deepEqual(test.pcv2.getRemoteMediaStreamTracks(), remoteTracks);
    });
  });

  describe('#getState', () => {
    [
      [
        'before setting a local description',
        test => {},
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
          await test.pcv2.update(test.state().setDescription(makeAnswer(), 1))
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
    let test;
    let description;
    let result;

    beforeEach(async () => {
      test = makeTest({ offers: 2 });

      [description, result] = await Promise.all([
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

      // NOTE(mroberts): Test a subsequent call to offer, too.
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
    ['createOffer', 'setLocalDescription'].forEach(errorScenario => {
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
            ['createOffer', 'setLocalDescription'].forEach(errorScenario => {
              context(`when ${errorScenario} on the underlying RTCPeerConnection fails`, () => {
                it('should throw a MediaClientLocalDescFailedError', async () => {
                  const test = makeTest({ offers: 1, errorScenario });

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

            beforeEach(async () => {
              test.pc.setLocalDescription = sinon.spy(test.pc.setLocalDescription);

              await test.pcv2.offer();

              offer = makeOffer();
              const offerDescription = test.state().setDescription(offer, 2);

              const resultPromise = test.pcv2.update(offerDescription);
              answer = await new Promise(resolve => test.pcv2.once('description', resolve));
              newOffer = await new Promise(resolve => test.pcv2.once('description', resolve));
              await resultPromise;
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
            ['createOffer', 'createAnswer', 'setLocalDescription', 'setRemoteDescription'].forEach(errorScenario => {
              context(`when ${errorScenario} on the underlying RTCPeerConnection fails`, () => {
                const expectedError = errorScenario === 'setRemoteDescription'
                  ? 'MediaClientRemoteDescFailedError'
                  : 'MediaClientLocalDescFailedError';

                const expectedErrorClass = errorScenario === 'setRemoteDescription'
                  ? MediaClientRemoteDescFailedError
                  : MediaClientLocalDescFailedError;

                const expectedErrorCode = errorScenario === 'setRemoteDescription'
                  ? 53402
                  : 53400;

                it(`should throw a ${expectedError}`, async () => {
                  const test = makeTest({ offers: 2, answers: 1, errorScenario });

                  const offer = makeOffer();
                  const offerDescription = test.state().setDescription(offer, 2);
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
            let offer;
            let answer;

            beforeEach(async () => {
              offer = makeOffer({ ufrag: 'foo' });
              const offerDescription = test.state().setDescription(offer, 1);

              const candidates = test.state().setIce(makeIce('foo', 1));
              await test.pcv2.update(candidates);

              const resultPromise = test.pcv2.update(offerDescription);
              answer = await new Promise(resolve => test.pcv2.once('description', resolve));
              await resultPromise;
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
            ['createAnswer', 'setLocalDescription', 'setRemoteDescription'].forEach(errorScenario => {
              context(`when ${errorScenario} on the underlying RTCPeerConnection fails`, () => {
                const expectedError = errorScenario === 'setRemoteDescription'
                  ? 'MediaClientRemoteDescFailedError'
                  : 'MediaClientLocalDescFailedError';

                const expectedErrorClass = errorScenario === 'setRemoteDescription'
                  ? MediaClientRemoteDescFailedError
                  : MediaClientLocalDescFailedError;

                const expectedErrorCode = errorScenario === 'setRemoteDescription'
                  ? 53402
                  : 53400;

                it(`should throw a ${expectedError}`, async () => {
                  const test = makeTest({ answers: 1, errorScenario });

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

            beforeEach(async () => {
              offer = makeOffer();
              const offerDescription = test.state().setDescription(offer, 1);

              await test.pcv2.offer();

              const resultPromise = test.pcv2.update(offerDescription);
              answer = await new Promise(resolve => test.pcv2.once('description', resolve));
              newOffer = await new Promise(resolve => test.pcv2.once('description', resolve));
              await resultPromise;
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
            ['createOffer', 'createAnswer', 'setLocalDescription', 'setRemoteDescription'].forEach(errorScenario => {
              context(`when ${errorScenario} on the underlying RTCPeerConnection fails`, () => {
                const expectedError = errorScenario === 'setRemoteDescription'
                  ? 'MediaClientRemoteDescFailedError'
                  : 'MediaClientLocalDescFailedError';

                const expectedErrorClass = errorScenario === 'setRemoteDescription'
                  ? MediaClientRemoteDescFailedError
                  : MediaClientLocalDescFailedError;

                const expectedErrorCode = errorScenario === 'setRemoteDescription'
                  ? 53402
                  : 53400;

                it(`should throw a ${expectedError}`, async () => {
                  const test = makeTest({ offers: 2, answers: 1, errorScenario });

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

    context('candidates', () => {
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

        beforeEach(async () => {
          test = makeTest({ offers: 1, answers: 1 });
          test.pc.addIceCandidate = sinon.spy(test.pc.addIceCandidate);

          const descriptionUfrag = 'foo';
          const descriptionRev = 1;

          let candidatesUfrag = matches ? descriptionUfrag : 'bar';
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
          await test.pcv2.update(iceState);
        });

        if (matches && newerEqualOrOlder === 'newer') {
          it('calls addIceCandidate with any new ICE candidates on the underlying RTCPeerConnection', () => {
            sinon.assert.calledTwice(test.pc.addIceCandidate);
            assert.deepEqual(
              test.pc.addIceCandidate.args[1][0],
              { candidate: 'candidate2' });
          });
        } else {
          it('does nothing', () => {
            if (matches) {
              sinon.assert.calledOnce(test.pc.addIceCandidate);
            } else {
              sinon.assert.notCalled(test.pc.addIceCandidate);
            }
          });
        }
      });
    });
  });

  describe('"candidates" event', () => {
    ['initial', 'subsequent', 'final'].forEach(which => {
      const description = 'when the underlying RTCPeerConnection\'s "icecandidate" event fires with' + {
        initial: 'an initial candidate for the current username fragment',
        subsequent: 'a subsequent candidate for the current username fragment',
        final: 'without a candidate (ICE gathering completed)'
      }[which];

      context(description, () => {
        let test;
        let iceState;

        beforeEach(async () => {
          test = makeTest({ offers: [makeOffer({ ufrag: 'foo' })] });

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
            it('with the full list of ICE candidates gathered up to that point', () => {
              assert.deepEqual(
                iceState.ice.candidates,
                [{ candidate: 'candidate1' },
                 { candidate: 'candidate2' }]);
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

    this.localStreams = [];
    this.remoteStreams = [];

    this.offerIndex = 0;
    this.answerIndex = 0;

    this.offers = offers;
    this.answers = answers;
    this.errorScenario = errorScenario || null;

    this.signalingState = 'stable';
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

  close() {
    this.signalingState = 'closed';
    this.emit('signalingstatechange');
  }

  addStream(stream) {
    this.localStreams.push(stream);
  }

  removeStream(stream) {
    const i = this.localStreams.indexOf(stream);
    if (i > -1) {
      this.localStreams.splice(i);
    }
  }

  getLocalStreams() {
    return this.localStreams;
  }

  getRemoteStreams() {
    return this.remoteStreams;
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

  return new PeerConnectionV2(options.id, {
    Event: function(type) { return { type: type }; },
    RTCIceCandidate: identity,
    RTCPeerConnection: options.RTCPeerConnection,
    RTCSessionDescription: identity,
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
    description.sdp = 'o=- ' + (Number.parseInt(Math.random() * 1000)) + '\r\n';
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
