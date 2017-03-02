'use strict';

var assert = require('assert');
var EventEmitter = require('events');
var FakeMediaStream = require('../../../../lib/fakemediastream').FakeMediaStream;
var FakeMediaStreamTrack = require('../../../../lib/fakemediastream').FakeMediaStreamTrack;
var PeerConnectionV2 = require('../../../../../lib/signaling/v2/peerconnection');
var TwilioErrors = require('../../../../../lib/util/twilio-video-errors');
var MediaClientLocalDescFailedError = TwilioErrors.MediaClientLocalDescFailedError;
var MediaClientRemoteDescFailedError = TwilioErrors.MediaClientRemoteDescFailedError;
var sinon = require('sinon');

describe('PeerConnectionV2', () => {
  describe('constructor', () => {
    it('sets .id', function() {
      var test = makeTest();
      assert.equal(test.id, test.peerConnectionV2.id);
    });
  });

  describe('#addMediaStream', () => {
    it('returns the PeerConnectionV2', () => {
      var test = makeTest();
      var mediaStream = {};
      assert.equal(test.peerConnectionV2, test.peerConnectionV2.addMediaStream(mediaStream));
    });

    it('calls addStream on the underlying RTCPeerConnection', () => {
      var test = makeTest();
      test.peerConnection.addStream = sinon.spy(test.peerConnection.addStream);
      var mediaStream = {};
      test.peerConnectionV2.addMediaStream(mediaStream);
      assert(test.peerConnection.addStream.calledWith(mediaStream));
    });
  });

  describe('#close', () => {
    context('in signaling state "closed"', () => {
      it('returns the PeerConnectionV2', () => {
        var test = makeTest();
        test.peerConnectionV2.close();
        assert.equal(test.peerConnectionV2, test.peerConnectionV2.close());
      });

      it('does not call close on the underlying RTCPeerConnection', () => {
        var test = makeTest();
        test.peerConnectionV2.close();
        test.peerConnection.close = sinon.spy(test.peerConnection.close);
        test.peerConnectionV2.close();
        assert(!test.peerConnection.close.calledOnce);
      });

      it('does not update the local description', () => {
        var test = makeTest();
        test.peerConnectionV2.close();
        var before = test.peerConnectionV2.getState();
        test.peerConnectionV2.close();
        assert.deepEqual(
          before,
          test.peerConnectionV2.getState());
      });
    });

    context('in signaling state "stable"', () => {
      it('returns the PeerConnectionV2', () => {
        var test = makeTest();
        assert.equal(test.peerConnectionV2, test.peerConnectionV2.close());
      });

      it('calls close on the underlying RTCPeerConnection', () => {
        var test = makeTest();
        test.peerConnection.close = sinon.spy(test.peerConnection.close);
        test.peerConnectionV2.close();
        assert(test.peerConnection.close.calledOnce);
      });

      it('sets the local description to a close description and increments the revision', () => {
        var test = makeTest();
        test.peerConnectionV2.close();
        assert.deepEqual(
          test.state().setDescription(makeClose(), 1),
          test.peerConnectionV2.getState());
      });

      it('emits a "description" event with the new local description', () => {
        var test = makeTest();
        test.peerConnectionV2.once('description', description => {
          assert.deepEqual(
            test.state().setDescription(makeClose(), 1),
            description);
        });
        test.peerConnectionV2.close();
      });
    });
  });

  describe('#getRemoteMediaStreamTracks', () => {
    it('returns the remote MediaStreamTracks of the underlying RTCPeerConnection', () => {
      var test = makeTest();
      var remoteStream = new FakeMediaStream();
      var remoteTracks = [
        new FakeMediaStreamTrack('audio'),
        new FakeMediaStreamTrack('video')
      ];

      remoteStream.addTrack(remoteTracks[0]);
      remoteStream.addTrack(remoteTracks[1]);
      test.peerConnection.getRemoteStreams = () => [ remoteStream ];
      assert.deepEqual(test.peerConnectionV2.getRemoteMediaStreamTracks(), remoteTracks);
    });
  });

  describe('#getState', () => {
    context('before setting a local description', () => {
      it('returns null', () => {
        var test = makeTest();
        assert.equal(null, test.peerConnectionV2.getState());
      });
    });

    context('after setting a local', () => {
      context('answer description', () => {
        context('with #update', () => {
          it('returns the local description', () => {
            var test = makeTest({ answers: 1 });
            var offerDescription = test.state().setDescription(makeOffer(), 1);
            return test.peerConnectionV2.update(offerDescription).then(() => {
              assert.deepEqual(
                test.state().setDescription(test.answers[0], 1),
                test.peerConnectionV2.getState());
            });
          });
        });
      });

      context('close description', () => {
        context('with #close', () => {
          it('returns the local description', () => {
            var test = makeTest();
            test.peerConnectionV2.close();
            assert.deepEqual(
              test.state().setDescription(makeClose(), 1),
              test.peerConnectionV2.getState());
          });
        });
      });

      context('offer description', () => {
        context('with #offer', () => {
          it('returns the local description', () => {
            var test = makeTest({ offers: 1 });
            return test.peerConnectionV2.offer().then(() => {
              assert.deepEqual(
                test.state().setDescription(test.offers[0], 1),
                test.peerConnectionV2.getState());
            });
          });
        });

        context('with #update', () => {
          it('returns the local description', () => {
            var test = makeTest({ offers: 1 });
            var createOfferDescription = test.state().setDescription(makeCreateOffer(), 1);
            return test.peerConnectionV2.update(createOfferDescription).then(() => {
              assert.deepEqual(
                test.state().setDescription(test.offers[0], 2),
                test.peerConnectionV2.getState());
            });
          });
        });
      });
    });
  });

  describe('#offer', () => {
    it('returns a Promise for the PeerConnectionV2', () => {
      var test = makeTest({ offers: 1 });
      return test.peerConnectionV2.offer().then(peerConnectionV2 => {
        assert.equal(test.peerConnectionV2, peerConnectionV2);
      });
    });

    it('calls createOffer and setLocalDescription on the underlying RTCPeerConnection', () => {
      var test = makeTest({ offers: 1 });
      return test.peerConnectionV2.offer().then(peerConnectionV2 => {
        assert.equal(test.offers[0], test.peerConnection.localDescription);
      });
    });

    it('sets the local description to an offer description and increments the revision', () => {
      var test = makeTest({ offers: 2 });
      return test.peerConnectionV2.offer().then(() => {
        assert.deepEqual(
          test.state().setDescription(test.offers[0], 1),
          test.peerConnectionV2.getState());
        return test.peerConnectionV2.offer();
      }).then(() => {
        assert.deepEqual(
          test.state().setDescription(test.offers[1], 2),
          test.peerConnectionV2.getState());
      });
    });

    it('emits a "description" event with the new local description', () => {
      var test = makeTest({ offers: 1 });
      test.peerConnectionV2.offer();
      return new Promise(resolve => {
        test.peerConnectionV2.once('description', resolve);
      }).then(description => {
        assert.deepEqual(
          test.state().setDescription(test.offers[0], 1),
          description);
      });
    });

    ['createOffer', 'setLocalDescription'].forEach(scenario => {
      context(`when ${scenario} on the underlying RTCPeerConnection fails`, () => {
        it('should throw a MediaClientLocalDescFailedError', () => {
          var test = makeTest({ offers: 1, errorScenario: scenario });
          return new Promise((resolve, reject) => {
            test.peerConnectionV2.offer().then(reject, function(error) {
              assert(error instanceof MediaClientLocalDescFailedError);
              assert.equal(error.code, 53400);
              resolve();
            });
          });
        });
      });
    });
  });

  describe('#removeMediaStream', () => {
    it('returns the PeerConnectionV2', () => {
      var test = makeTest();
      var mediaStream = {};
      test.peerConnectionV2.addMediaStream(mediaStream);
      assert.equal(test.peerConnectionV2, test.peerConnectionV2.removeMediaStream(mediaStream));
    });

    it('calls removeStream on the underlying RTCPeerConnection', () => {
      var test = makeTest();
      test.peerConnection.removeStream = sinon.spy();
      var mediaStream = {};
      test.peerConnectionV2.addMediaStream(mediaStream);
      test.peerConnectionV2.removeMediaStream(mediaStream);
      assert(test.peerConnection.removeStream.calledWith(mediaStream));
    });
  });

  describe('#setConfiguration', () => {
    context('when setConfiguration is supported by the underlying RTCPeerConnection', () => {
      it('calls setConfiguration on the underlying RTCPeerConnection', () => {
        var test = makeTest();
        var configuration;
        test.peerConnection.setConfiguration = _configuration => configuration = _configuration;
        test.peerConnectionV2.setConfiguration({
          iceServers: ['foo'],
          iceTransportPolicy: 'bar'
        });
        assert.deepEqual(
          {
            bundlePolicy: 'max-bundle',
            iceServers: ['foo'],
            iceTransportPolicy: 'bar',
            rtcpMuxPolicy: 'require'
          },
          configuration);
      });
    });

    context('when setConfiguration is not supported by the underlying RTCPeerConnection', () => {
      it('does not call setConfiguration on the underlying RTCPeerConnection', () => {
        var test = makeTest();
        test.peerConnectionV2.setConfiguration({ fizz: 'buzz' });
      });
    });
  });

  describe('#update', () => {
    context('called with', () => {
      context('an answer description at', () => {
        context('a new revision', () => {
          it('does nothing', () => {
            var test = makeTest({ offers: 1 });
            var answerDescription = test.state().setDescription(makeAnswer(), 2);
            return test.peerConnectionV2.offer().then(() => {
              return test.peerConnectionV2.update(answerDescription);
            }).then(() => {
              assert(!test.peerConnection.setRemoteDescription.calledOnce);
            });
          });
        });

        context('the same revision', () => {
          context('in signaling state "closed"', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              var closeDescription = test.state().setDescription(makeClose(), 1);
              var answerDescription = test.state().setDescription(makeAnswer(), 1);
              return test.peerConnectionV2.update(closeDescription).then(() => {
                test.peerConnection.setRemoteDescription = sinon.spy(test.peerConnection.setRemoteDescription);
                return test.peerConnectionV2.update(answerDescription);
              }).then(() => {
                assert(!test.peerConnection.setRemoteDescription.calledOnce);
              });
            });
          });

          context('in signaling state "have-local-offer"', () => {
            it('calls setRemoteDescription with the answer description on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 1 });
              var answer = makeAnswer();
              var answerDescription = test.state().setDescription(answer, 1);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(answerDescription);
              }).then(() => {
                assert.deepEqual(
                  Object.assign({ revision: 1 }, answer),
                  test.peerConnection.remoteDescription);
              });
            });

            context('when setRemoteDescription on the underlying RTCPeerConnection fails', () => {
              it('should throw a MediaClientRemoteDescFaileError', () => {
                var test = makeTest({ offers: 1, errorScenario: 'setRemoteDescription' });
                var answer = makeAnswer();
                var answerDescription = test.state().setDescription(answer, 1);
                return new Promise((resolve, reject) => {
                  test.peerConnectionV2.offer().then(() => {
                    return test.peerConnectionV2.update(answerDescription);
                  }).then(reject, error => {
                    assert(error instanceof MediaClientRemoteDescFailedError);
                    assert.equal(error.code, 53402);
                    resolve();
                  });
                });
              });
            });

            it('calls addIceCandidate with any previously-received matching ICE candidates on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 1 });
              test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
              var answerDescription = test.state().setDescription(makeAnswer({ ufrag: 'bar' }), 1);
              var candidates = test.state().setIce(makeIce('bar', 1));
              return test.peerConnectionV2.update(candidates).then(() => {
                return test.peerConnectionV2.offer();
              }).then(() => {
                return test.peerConnectionV2.update(answerDescription);
              }).then(() => {
                assert.deepEqual(
                  { candidate: 'candidate1' },
                  test.peerConnection.addIceCandidate.args[0][0]);
              });
            });

            it('does not update the local description', () => {
              var test = makeTest({ offers: 1 });
              var answerDescription = test.state().setDescription(makeAnswer(), 1);
              var before;
              return test.peerConnectionV2.offer().then(() => {
                before = test.peerConnectionV2.getState();
                return test.peerConnectionV2.update(answerDescription);
              }).then(() => {
                assert.deepEqual(
                  before,
                  test.peerConnectionV2.getState());
              });
            });
          });

          context('in signaling state "stable"', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              var answerDescription = test.state().setDescription(makeAnswer(), 1);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(answerDescription);
              }).then(() => {
                test.peerConnection.setRemoteDescription = sinon.spy(test.peerConnection.setRemoteDescription);
                return test.peerConnectionV2.update(answerDescription);
              }).then(() => {
                assert(!test.peerConnection.setRemoteDescription.calledOnce);
              });
            });
          });
        });

        context('an old revision', () => {
          it('does nothing', () => {
            var test = makeTest({ offers: 1 });
            return test.peerConnectionV2.offer().then(() => {
              return test.peerConnectionV2.update(
                test.state().setDescription(makeAnswer(), 0));
            }).then(() => {
              assert(!test.peerConnection.setRemoteDescription.calledOnce);
            });
          });
        });
      });

      context('a close description at', () => {
        context('a new revision', () => {
          context('in signaling state "closed"', () => {
            it('does nothing', () => {
              var test = makeTest();
              var closeDescription1 = test.state().setDescription(makeClose(), 1);
              var closeDescription2 = test.state().setDescription(makeClose(), 2);
              return test.peerConnectionV2.update(closeDescription1).then(() => {
                test.peerConnection.close = sinon.spy();
                return test.peerConnectionV2.update(closeDescription2);
              }).then(() => {
                assert(!test.peerConnection.close.calledOnce);
              });
            });
          });

          context('in signaling state "have-local-offer"', () => {
            it('calls close on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 1 });
              test.peerConnection.close = sinon.spy();
              var closeDescription = test.state().setDescription(makeClose(), 2);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(closeDescription);
              }).then(() => {
                assert(test.peerConnection.close.calledOnce);
              });
            });

            it('does not update the local description', () => {
              var test = makeTest({ offers: 1 });
              var closeDescription = test.state().setDescription(makeClose(), 2);
              var before;
              return test.peerConnectionV2.offer().then(() => {
                before = test.peerConnectionV2.getState();
                return test.peerConnectionV2.update(closeDescription);
              }).then(() => {
                assert.deepEqual(
                  before,
                  test.peerConnectionV2.getState());
              });
            });
          });

          context('in signaling state "stable"', () => {
            it('calls close on the underlying RTCPeerConnection', () => {
              var test = makeTest();
              test.peerConnection.close = sinon.spy();
              var closeDescription = test.state().setDescription(makeClose(), 1);
              return test.peerConnectionV2.update(closeDescription).then(() => {
                assert(test.peerConnection.close.calledOnce);
              });
            });

            it('does not update the local description', () => {
              var test = makeTest();
              var closeDescription = test.state().setDescription(makeClose(), 1);
              var before;
              before = test.peerConnectionV2.getState();
              return test.peerConnectionV2.update(closeDescription).then(() => {
                assert.deepEqual(
                  before,
                  test.peerConnectionV2.getState());
              });
            });
          });
        });

        context('the same revision', () => {
          context('in signaling state "closed"', () => {
            it('does nothing', () => {
              var test = makeTest();
              var closeDescription = test.state().setDescription(makeClose(), 1);
              return test.peerConnectionV2.update(closeDescription).then(() => {
                test.peerConnection.close = sinon.spy();
                return test.peerConnectionV2.update(closeDescription);
              }).then(() => {
                assert(!test.peerConnection.close.calledOnce);
              });
            });
          });

          context('in signaling state "have-local-offer"', () => {
            it('calls close on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 1 });
              test.peerConnection.close = sinon.spy();
              var closeDescription = test.state().setDescription(makeClose(), 1);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(closeDescription);
              }).then(() => {
                assert(test.peerConnection.close.calledOnce);
              });
            });

            it('does not update the local description', () => {
              var test = makeTest({ offers: 1 });
              var closeDescription = test.state().setDescription(makeClose(), 1);
              var before;
              return test.peerConnectionV2.offer().then(() => {
                before = test.peerConnectionV2.getState();
                return test.peerConnectionV2.update(closeDescription);
              }).then(() => {
                assert.deepEqual(
                  before,
                  test.peerConnectionV2.getState());
              });
            });
          });

          context('in signaling state "stable"', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              test.peerConnection.close = sinon.spy();
              var answerDescription = test.state().setDescription(makeAnswer(), 1);
              var closeDescription = test.state().setDescription(makeClose(), 1);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(answerDescription);
              }).then(() => {
                return test.peerConnectionV2.update(closeDescription);
              }).then(() => {
                assert(!test.peerConnection.close.calledOnce);
              });
            });
          });
        });

        context('an old revision', () => {
          it('does nothing', () => {
            var test = makeTest({ offers: 1 });
            test.peerConnection.close = sinon.spy();
            return test.peerConnectionV2.offer().then(() => {
              return test.peerConnectionV2.update(
                test.state().setDescription(makeClose(), 0));
            }).then(() => {
              assert(!test.peerConnection.close.calledOnce);
            });
          });
        });
      });

      context('a create-offer description at', () => {
        context('a new revision', () => {
          context('in signaling state "closed"', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              var closeDescription = test.state().setDescription(makeClose(), 1);
              var createOfferDescription = test.state().setDescription(makeCreateOffer(), 2);
              var before;
              return test.peerConnectionV2.update(closeDescription).then(() => {
                before = test.peerConnectionV2.getState();
                return test.peerConnectionV2.update(createOfferDescription);
              }).then(() => {
                assert.deepEqual(
                  before,
                  test.peerConnectionV2.getState());
              });
            });
          });

          context('in signaling state "stable"', () => {
            it('calls createOffer and setLocalDescription on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 1 });
              var createOfferDescription = test.state().setDescription(makeCreateOffer(), 1);
              return test.peerConnectionV2.update(createOfferDescription).then(() => {
                assert.deepEqual(
                  test.offers[0],
                  test.peerConnection.localDescription);
              });
            });

            ['createOffer', 'setLocalDescription'].forEach(scenario => {
              context(`when ${scenario} on the underlying RTCPeerConnection fails`, () => {
                it('should throw a MediaClientLocalDescFailedError', () => {
                  var test = makeTest({ offers: 1, errorScenario: scenario });
                  var createOfferDescription = test.state().setDescription(makeCreateOffer(), 1);
                  return new Promise((resolve, reject) => {
                    test.peerConnectionV2.update(createOfferDescription).then(reject, error => {
                      assert(error instanceof MediaClientLocalDescFailedError);
                      assert.equal(error.code, 53400);
                      resolve();
                    });
                  });
                });
              });
            });

            it('sets the local description to an offer description and increments the revision', () => {
              var test = makeTest({ offers: 1 });
              var createOfferDescription = test.state().setDescription(makeCreateOffer(), 1);
              return test.peerConnectionV2.update(createOfferDescription).then(() => {
                assert.deepEqual(
                  test.state().setDescription(test.offers[0], 2),
                  test.peerConnectionV2.getState());
              });
            });

            it('emits a "description" event with the new local description', () => {
              var test = makeTest({ offers: 1 });
              var createOfferDescription = test.state().setDescription(makeCreateOffer(), 1);
              test.peerConnectionV2.update(createOfferDescription);
              return new Promise(resolve => {
                test.peerConnectionV2.once('description', resolve);
              }).then(description => {
                assert.deepEqual(
                  test.state().setDescription(test.offers[0], 2),
                  description);
              });
            });
          });

          context('in signaling state "have-local-offer"', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              var createOfferDescription = test.state().setDescription(makeCreateOffer(), 2);
              var before;
              return test.peerConnectionV2.offer().then(() => {
                before = test.peerConnectionV2.getState();
                return test.peerConnectionV2.update(createOfferDescription);
              }).then(() => {
                assert.deepEqual(
                  before,
                  test.peerConnectionV2.getState());
              });
            });
          });
        });

        context('the same revision', () => {
          it('does nothing', () => {
            var test = makeTest({ offers: 2 });
            var before;
            return test.peerConnectionV2.offer().then(() => {
              before = test.peerConnectionV2.getState();
              return test.peerConnectionV2.update(
                test.state().setDescription(makeCreateOffer(), 1));
            }).then(() => {
              assert.deepEqual(
                before,
                test.peerConnectionV2.getState());
            });
          });
        });

        context('an old revision', () => {
          it('does nothing', () => {
            var test = makeTest({ offers: 1 });
            var before;
            return test.peerConnectionV2.offer().then(() => {
              before = test.peerConnectionV2.getState();
              return test.peerConnectionV2.update(
                test.state().setDescription(makeCreateOffer(), 0));
            }).then(() => {
              assert.deepEqual(
                before,
                test.peerConnectionV2.getState());
            });
          });
        });
      });

      context('an offer description at', () => {
        context('a new revision', () => {
          context('in signaling state "closed"', () => {
            it('does nothing', () => {
              var test = makeTest();
              var closeDescription = test.state().setDescription(makeClose(), 1);
              var offerDescription = test.state().setDescription(makeOffer(), 2);
              var before;
              return test.peerConnectionV2.update(closeDescription).then(() => {
                before = test.peerConnectionV2.getState();
                return test.peerConnectionV2.update(offerDescription);
              }).then(() => {
                assert.deepEqual(
                  before,
                  test.peerConnectionV2.getState());
              });
            });
          });

          context('in signaling state "have-local-offer" (glare)', () => {
            it('calls setLocalDescription with a rollback description on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              test.peerConnection.setLocalDescription = sinon.spy(test.peerConnection.setLocalDescription);
              var offer = makeOffer();
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(
                  test.state().setDescription(offer, 2)
                );
              }).then(() => {
                assert.deepEqual(
                  { type: 'rollback' },
                  test.peerConnection.setLocalDescription.args[1][0]);
              });
            });

            it('calls setRemoteDescription with the offer description on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              var offer = makeOffer();
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(
                  test.state().setDescription(offer, 2));
              }).then(() => {
                assert.deepEqual(
                  Object.assign({ revision: 2 }, offer),
                  test.peerConnection.remoteDescription);
              });
            });

            it('calls createAnswer and setLocalDescription on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              test.peerConnection.setLocalDescription = sinon.spy(test.peerConnection.setLocalDescription);
              var offer = makeOffer();
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(
                  test.state().setDescription(offer, 2));
              }).then(() => {
                assert.deepEqual(
                  test.answers[0],
                  test.peerConnection.setLocalDescription.args[2][0]);
              });
            });

            it('calls createOffer and setLocalDescription on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              test.peerConnection.setLocalDescription = sinon.spy(test.peerConnection.setLocalDescription);
              var offer = makeOffer();
              var offerDescription = test.state().setDescription(offer, 2);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(offerDescription);
              }).then(() => {
                assert.deepEqual(
                  test.offers[1],
                  test.peerConnection.setLocalDescription.args[3][0]);
              });
            });

            it('sets the local description to an offer description and increments the revision', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              var offerDescription = test.state().setDescription(makeOffer(), 2);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(offerDescription);
              }).then(() => {
                assert.deepEqual(
                  test.state().setDescription(test.offers[1], 3),
                  test.peerConnectionV2.getState());
              });
            });

            it('emits two "description" events: first an answer description, then an offer description', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              var offerDescription = test.state().setDescription(makeOffer(), 2);
              return test.peerConnectionV2.offer().then(() => {
                test.peerConnectionV2.update(offerDescription);
                return new Promise(resolve => {
                  test.peerConnectionV2.once('description', answer => {
                    test.peerConnectionV2.once('description', offer => {
                      resolve([answer, offer]);
                    });
                  });
                }).then(descriptions => {
                  assert.deepEqual(
                    test.state().setDescription(test.answers[0], 2),
                    descriptions[0]);
                  assert.deepEqual(
                    test.state().setDescription(test.offers[1], 3),
                    descriptions[1]);
                });
              });
            });

            ['createOffer', 'createAnswer', 'setLocalDescription', 'setRemoteDescription'].forEach(scenario => {
              context(`when ${scenario} on the underlying RTCPeerConnection fails`, () => {
                var expectedError = scenario === 'setRemoteDescription'
                  ? 'MediaClientRemoteDescFailedError'
                  : 'MediaClientLocalDescFailedError';
                var expectedErrorClass = scenario === 'setRemoteDescription'
                  ? MediaClientRemoteDescFailedError
                  : MediaClientLocalDescFailedError;
                var expectedErrorCode = scenario === 'setRemoteDescription'
                  ? 53402
                  : 53400;

                it(`should throw a ${expectedError}`, () => {
                  var test = makeTest({ offers: 2, answers: 1, errorScenario: scenario });
                  var offerDescription = test.state().setDescription(makeOffer(), 2);
                  return new Promise((resolve, reject) => {
                    return test.peerConnectionV2.offer().then(() => {
                      return test.peerConnectionV2.update(offerDescription);
                    }).then(reject, error => {
                      assert(error instanceof expectedErrorClass);
                      assert.equal(error.code, expectedErrorCode);
                      resolve();
                    });
                  });
                });
              });
            });
          });

          context('in signaling state "stable"', () => {
            it('calls setRemoteDescription with the offer description on the underlying RTCPeerConnection', () => {
              var test = makeTest({ answers: 1 });
              var offer = makeOffer();
              var offerDescription = test.state().setDescription(offer, 1);
              return test.peerConnectionV2.update(offerDescription).then(() => {
                assert.deepEqual(
                  Object.assign({ revision: 1 }, offer),
                  test.peerConnection.remoteDescription);
              });
            });

            it('calls createAnswer and setLocalDescription on the underlying RTCPeerConnection', () => {
              var test = makeTest({ answers: 1 });
              var offerDescription = test.state().setDescription(makeOffer(), 1);
              return test.peerConnectionV2.update(offerDescription).then(() => {
                assert.deepEqual(
                  test.answers[0],
                  test.peerConnection.localDescription);
              });
            });

            it('calls addIceCandidate with any previously-received matching ICE candidates on the underlying RTCPeerConnection', () => {
              var test = makeTest({ answers: 1 });
              test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
              var offerDescription = test.state().setDescription(makeOffer({ ufrag: 'foo' }), 1);
              var candidates = test.state().setIce(makeIce('foo', 1));
              return test.peerConnectionV2.update(candidates).then(() => {
                return test.peerConnectionV2.update(offerDescription);
              }).then(() => {
                assert.deepEqual(
                  { candidate: 'candidate1' },
                  test.peerConnection.addIceCandidate.args[0][0]);
              });
            });

            it('sets the local description to an answer description at the new revision', () => {
              var test = makeTest({ answers: 1 });
              var offerDescription = test.state().setDescription(makeOffer(), 1);
              return test.peerConnectionV2.update(offerDescription).then(() => {
                assert.deepEqual(
                  test.state().setDescription(test.answers[0], 1),
                  test.peerConnectionV2.getState());
              });
            });

            it('emits a "description" event with the new local description', () => {
              var test = makeTest({ answers: 1 });
              var offerDescription = test.state().setDescription(makeOffer(), 1);
              test.peerConnectionV2.update(offerDescription).then();
              return new Promise(resolve => {
                test.peerConnectionV2.once('description', resolve);
              }).then(description => {
                assert.deepEqual(
                  test.state().setDescription(test.answers[0], 1),
                  description);
              });
            });

            ['createAnswer', 'setLocalDescription', 'setRemoteDescription'].forEach(scenario => {
              context(`when ${scenario} on the underlying RTCPeerConnection fails`, () => {
                var expectedError = scenario === 'setRemoteDescription'
                  ? 'MediaClientRemoteDescFailedError'
                  : 'MediaClientLocalDescFailedError';
                var expectedErrorClass = scenario === 'setRemoteDescription'
                  ? MediaClientRemoteDescFailedError
                  : MediaClientLocalDescFailedError;
                var expectedErrorCode = scenario === 'setRemoteDescription'
                  ? 53402
                  : 53400;

                it(`should throw a ${expectedError}`, () => {
                  var test = makeTest({ answers: 1, errorScenario: scenario });
                  var offerDescription = test.state().setDescription(makeOffer(), 1);
                  return new Promise((resolve, reject) => {
                    return test.peerConnectionV2.update(offerDescription).then(reject, error => {
                      assert(error instanceof expectedErrorClass);
                      assert.equal(error.code, expectedErrorCode);
                      resolve();
                    });
                  });
                });
              });
            });
          });
        });

        context('the same revision', () => {
          context('in signaling state "closed"', () => {
            it('does nothing', () => {
              var test = makeTest();
              var closeDescription = test.state().setDescription(makeClose(), 1);
              var offerDescription = test.state().setDescription(makeOffer(), 1);
              var before;
              return test.peerConnectionV2.update(closeDescription).then(() => {
                before = test.peerConnectionV2.getState();
                return test.peerConnectionV2.update(offerDescription);
              }).then(() => {
                assert.deepEqual(
                  before,
                  test.peerConnectionV2.getState());
              });
            });
          });

          context('in signaling state "have-local-offer" (glare)', () => {
            it('calls setLocalDescription with a rollback description on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              test.peerConnection.setLocalDescription = sinon.spy(test.peerConnection.setLocalDescription);
              var offer = makeOffer();
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(
                  test.state().setDescription(offer, 1)
                );
              }).then(() => {
                assert.deepEqual(
                  { type: 'rollback' },
                  test.peerConnection.setLocalDescription.args[1][0]);
              });
            });

            it('calls setRemoteDescription with the offer description on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              var offer = makeOffer();
              var offerDescription = test.state().setDescription(offer, 1);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(offerDescription);
              }).then(() => {
                assert.deepEqual(
                  Object.assign({ revision: 1 }, offer),
                  test.peerConnection.remoteDescription);
              });
            });

            it('calls createAnswer and setLocalDescription on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              test.peerConnection.setLocalDescription = sinon.spy(test.peerConnection.setLocalDescription);
              var offerDescription = test.state().setDescription(makeOffer(), 1);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(offerDescription);
              }).then(() => {
                assert.deepEqual(
                  test.answers[0],
                  test.peerConnection.setLocalDescription.args[2][0]);
              });
            });

            it('calls createOffer and setLocalDescription on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              test.peerConnection.setLocalDescription = sinon.spy(test.peerConnection.setLocalDescription);
              var offerDescription = test.state().setDescription(makeOffer(), 1);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(offerDescription);
              }).then(() => {
                assert.deepEqual(
                  test.offers[1],
                  test.peerConnection.setLocalDescription.args[3][0]);
              });
            });

            it('sets the local description to an offer description and increments the revision', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              var offerDescription = test.state().setDescription(makeOffer(), 1);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(offerDescription);
              }).then(() => {
                assert.deepEqual(
                  test.state().setDescription(test.offers[1], 2),
                  test.peerConnectionV2.getState());
              });
            });

            it('emits a "description" event with the new local description', () => {
              var test = makeTest({ offers: 2, answers: 1 });
              var offerDescription = test.state().setDescription(makeOffer(), 1);
              return test.peerConnectionV2.offer().then(() => {
                test.peerConnectionV2.update(offerDescription);
                return new Promise(resolve => {
                  test.peerConnectionV2.once('description', answer => {
                    test.peerConnectionV2.once('description', offer => {
                      resolve([answer, offer]);
                    });
                  });
                }).then(descriptions => {
                  assert.deepEqual(
                    test.state().setDescription(test.answers[0], 1),
                    descriptions[0]);
                  assert.deepEqual(
                    test.state().setDescription(test.offers[1], 2),
                    descriptions[1]);
                });
              });
            });

            ['createOffer', 'createAnswer', 'setLocalDescription', 'setRemoteDescription'].forEach(scenario => {
              context(`when ${scenario} on the underlying RTCPeerConnection fails`, () => {
                var expectedError = scenario === 'setRemoteDescription'
                  ? 'MediaClientRemoteDescFailedError'
                  : 'MediaClientLocalDescFailedError';
                var expectedErrorClass = scenario === 'setRemoteDescription'
                  ? MediaClientRemoteDescFailedError
                  : MediaClientLocalDescFailedError;
                var expectedErrorCode = scenario === 'setRemoteDescription'
                  ? 53402
                  : 53400;

                it(`should throw a ${expectedError}`, () => {
                  var test = makeTest({ offers: 2, answers: 1, errorScenario: scenario });
                  var offerDescription = test.state().setDescription(makeOffer(), 1);
                  return new Promise((resolve, reject) => {
                    return test.peerConnectionV2.offer().then(() => {
                      return test.peerConnectionV2.update(offerDescription);
                    }).then(reject, error => {
                      assert(error instanceof expectedErrorClass);
                      assert.equal(error.code, expectedErrorCode);
                      resolve();
                    });
                  });
                });
              });
            });
          });

          context('in signaling state "stable"', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              var answerDescription = test.state().setDescription(makeAnswer(), 1);
              var offerDescription = test.state().setDescription(makeClose(), 1);
              var before;
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(answerDescription);
              }).then(() => {
                before = test.peerConnectionV2.getState();
                return test.peerConnectionV2.update(offerDescription);
              }).then(() => {
                assert.deepEqual(
                  before,
                  test.peerConnectionV2.getState());
              });
            });
          });
        });

        context('an old revision', () => {
          it('does nothing', () => {
            var test = makeTest({ offers: 1, answers: 1 });
            var before;
            return test.peerConnectionV2.offer().then(() => {
              return test.peerConnectionV2.update(
                test.state().setDescription(makeAnswer(), 1));
            }).then(() => {
              before = test.peerConnectionV2.getState();
              return test.peerConnectionV2.update(
                test.state().setDescription(makeOffer(), 1));
            }).then(() => {
              assert.deepEqual(
                before,
                test.peerConnectionV2.getState());
            });
          });
        });
      });
    });

    context('called with candidates', () => {
      context('whose username fragment matches that of the current remote', () => {
        context('answer description', () => {
          context('at a new revision', () => {
            it('calls addIceCandidate with any new ICE candidates on the underlying RTCPeerConnection', () => {
              var test = makeTest({ offers: 1 });
              test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(
                  test.state().setDescription(makeAnswer({ ufrag: 'bar' }), 1));
              }).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('bar', 1)));
              }).then(() => {
                assert.deepEqual(
                  { candidate: 'candidate1' },
                  test.peerConnection.addIceCandidate.args[0][0]);
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('bar', 2)));
              }).then(() => {
                assert.deepEqual(
                  { candidate: 'candidate2' },
                  test.peerConnection.addIceCandidate.args[1][0]);
              });
            });
          });

          context('at the same revision', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(
                  test.state().setDescription(makeAnswer({ ufrag: 'bar' }, 1)));
              }).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('bar', 1)));
              }).then(() => {
                test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('bar', 1)));
              }).then(() => {
                assert(!test.peerConnection.addIceCandidate.calledOnce);
              });
            });
          });

          context('at an old revision', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(
                  test.state().setDescription(makeAnswer({ ufrag: 'bar' }), 2));
              }).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('bar', 2)));
              }).then(() => {
                test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('bar', 1)));
              }).then(() => {
                assert(!test.peerConnection.addIceCandidate.calledOnce);
              });
            });
          });
        });

        context('offer description', () => {
          context('at a new revision', () => {
            it('calls addIceCandidate with any new ICE candidates on the underlying RTCPeerConnection', () => {
              var test = makeTest({ answers: 1 });
              test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
              return test.peerConnectionV2.update(
                test.state().setDescription(makeOffer({ ufrag: 'foo' }), 2)
              ).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('foo', 1)));
              }).then(() => {
                assert.deepEqual(
                  { candidate: 'candidate1' },
                  test.peerConnection.addIceCandidate.args[0][0]);
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('foo', 2)));
              }).then(() => {
                assert.deepEqual(
                  { candidate: 'candidate2' },
                  test.peerConnection.addIceCandidate.args[1][0]);
              });
            });
          });

          context('at the same revision', () => {
            it('does nothing', () => {
              var test = makeTest({ answers: 1 });
              return test.peerConnectionV2.update(
                test.state().setDescription(makeOffer({ ufrag: 'foo' }), 2)
              ).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('foo', 1)));
              }).then(() => {
                test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('foo', 1)));
              }).then(() => {
                assert(!test.peerConnection.addIceCandidate.calledOnce);
              });
            });
          });

          context('at an old revision', () => {
            it('does nothing', () => {
              var test = makeTest({ answers: 1 });
              return test.peerConnectionV2.update(
                test.state().setDescription(makeOffer({ ufrag: 'foo' }), 2)
              ).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('foo', 2)));
              }).then(() => {
                test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('foo', 1)));
              }).then(() => {
                assert(!test.peerConnection.addIceCandidate.calledOnce);
              });
            });
          });
        });
      });

      context('whose username fragment does not match that of the current remote', () => {
        context('answer description', () => {
          context('at a new revision', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(
                  test.state().setDescription(makeAnswer({ ufrag: 'fizz' }), 1));
              }).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('buzz', 1)));
              }).then(() => {
                assert(!test.peerConnection.addIceCandidate.calledOnce);
              });
            });
          });

          context('at the same revision', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(
                  test.state().setDescription(makeAnswer({ ufrag: 'fizz' }), 1));
              }).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('buzz', 1)));
              }).then(() => {
                test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('buzz', 1)));
              }).then(() => {
                assert(!test.peerConnection.addIceCandidate.calledOnce);
              });
            });
          });

          context('at an old revision', () => {
            it('does nothing', () => {
              var test = makeTest({ offers: 1 });
              return test.peerConnectionV2.offer().then(() => {
                return test.peerConnectionV2.update(
                  test.state().setDescription(makeAnswer({ ufrag: 'fizz' }), 1));
              }).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('buzz', 2)));
              }).then(() => {
                test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('buzz', 1)));
              }).then(() => {
                assert(!test.peerConnection.addIceCandidate.calledOnce);
              });
            });
          });
        });

        context('offer description', () => {
          context('at a new revision', () => {
            it('does nothing', () => {
              var test = makeTest({ answers: 1 });
              test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
              return test.peerConnectionV2.update(
                test.state().setDescription(makeOffer({ ufrag: 'fizz' }), 1)
              ).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('buzz', 1)));
              }).then(() => {
                assert(!test.peerConnection.addIceCandidate.calledOnce);
              });
            });
          });

          context('at the same revision', () => {
            it('does nothing', () => {
              var test = makeTest({ answers: 1 });
              return test.peerConnectionV2.update(
                test.state().setDescription(makeOffer({ ufrag: 'fizz' }), 1)
              ).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('buzz', 1)));
              }).then(() => {
                test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('buzz', 1)));
              }).then(() => {
                assert(!test.peerConnection.addIceCandidate.calledOnce);
              });
            });
          });

          context('at an old revision', () => {
            it('does nothing', () => {
              var test = makeTest({ answers: 1 });
              return test.peerConnectionV2.update(
                test.state().setDescription(makeOffer({ ufrag: 'fizz' }), 1)
              ).then(() => {
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('buzz', 2)));
              }).then(() => {
                test.peerConnection.addIceCandidate = sinon.spy(test.peerConnection.addIceCandidate);
                return test.peerConnectionV2.update(
                  test.state().setIce(makeIce('buzz', 1)));
              }).then(() => {
                assert(!test.peerConnection.addIceCandidate.calledOnce);
              });
            });
          });
        });
      });
    });
  });

  describe('"candidates" event', () => {
    context('when the underlying RTCPeerConnection\'s "icecandidate" event fires with an initial candidate for the current username fragment', () => {
      it('emits the event with a single-element list of ICE candidates', () => {
        var test = makeTest({ offers: [makeOffer({ ufrag: 'foo' })] });
        return test.peerConnectionV2.offer().then(() => {
          var promise = new Promise(resolve => {
            test.peerConnectionV2.once('candidates', resolve);
          });
          test.peerConnection.emit('icecandidate', {
            type: 'icecandidate',
            candidate: { candidate: 'candidate1' }
          });
          return promise;
        }).then(iceState => {
          assert.deepEqual(
            test.state().setIce(makeIce('foo', 1)),
            iceState);
        });
      });
    });

    context('when the underlying RTCPeerConnection\'s "icecandidate" event fires with subsequent candidates for the current username fragment', () => {
      it('emits the event with the full list of ICE candidates gathered up to that point', () => {
        var test = makeTest({ offers: [makeOffer({ ufrag: 'foo' })] });
        return test.peerConnectionV2.offer().then(() => {
          test.peerConnection.emit('icecandidate', {
            type: 'icecandidate',
            candidate: { candidate: 'candidate1' }
          });
          var promise = new Promise(resolve => {
            test.peerConnectionV2.once('candidates', resolve);
          });
          test.peerConnection.emit('icecandidate', {
            type: 'icecandidate',
            candidate: { candidate: 'candidate2' }
          });
          return promise;
        }).then(iceState => {
          assert.deepEqual(
            test.state().setIce(makeIce('foo', 2)),
            iceState);
        });
      });
    });

    context('when the underlying RTCPeerConnection\'s "icecandidate" fires without a candidate (ICE gathering completed)', () => {
      it('emits the event with the full list of ICE candidates gathered up to that point', () => {
        var test = makeTest({ offers: [makeOffer({ ufrag: 'foo' })] });
        return test.peerConnectionV2.offer().then(() => {
          test.peerConnection.emit('icecandidate', {
            type: 'icecandidate',
            candidate: { candidate: 'candidate1' }
          });
          test.peerConnection.emit('icecandidate', {
            type: 'icecandidate',
            candidate: { candidate: 'candidate2' }
          });
          var promise = new Promise(resolve => {
            test.peerConnectionV2.once('candidates', resolve);
          });
          test.peerConnection.emit('icecandidate', {
            type: 'icecandidate',
            candidate: null
          });
          return promise;
        }).then(iceState => {
          var endOfCandidatesIceState = test.state().setIce(makeIce('foo', 2));
          endOfCandidatesIceState.ice.complete = true;
          endOfCandidatesIceState.ice.revision = 3;
          assert.deepEqual(
            endOfCandidatesIceState,
            iceState);
        });
      });
    });
  });

  describe('"trackAdded" event', () => {
    context('when "track" events are supported by the underlying RTCPeerConnection', () => {
      it('emits the "trackAdded" event directly from the underlying RTCPeerConnection\'s "track" event handler', () => {
        var peerConnection = makePeerConnection();
        function RTCPeerConnection() {
          return peerConnection;
        }
        RTCPeerConnection.prototype.ontrack = null;
        var test = makeTest({
          RTCPeerConnection: RTCPeerConnection
        });
        var promise = new Promise(resolve => {
          test.peerConnectionV2.once('trackAdded', mediaStreamTrack => {
            resolve(mediaStreamTrack);
          })
        });

        var mediaStreamTrack = { id: '456' };
        var mediaStream = { id: 'abc' };

        peerConnection.emit('track', {
          type: 'track',
          track: mediaStreamTrack,
          streams: [mediaStream]
        });

        return promise.then(track => {
          assert.equal(mediaStreamTrack, track);
        });
      });
    });
  });
});

function makeTest(options) {
  options = options || {};
  options.id = options.id || makeId();
  options.peerConnection = options.peerConnection || makePeerConnection(options);
  options.peerConnectionV2 = makePeerConnectionV2(options);
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
    var offers = [];
    for (var i = 0; i < options.offers; i++) {
      offers.push(makeOffer());
    }
    options.offers = offers;
  }

  if (typeof options.answers === 'number') {
    var answers = [];
    for (var i = 0; i < options.answers; i++) {
      answers.push(makeAnswer());
    }
    options.answers = answers;
  }

  options.offers = options.offers.map(description => description instanceof Description
    ? description : new Description(description));

  options.answers = options.answers.map(description => description instanceof Description
    ? description : new Description(description));

  var offerIndex = 0;
  var answerIndex = 0;

  var peerConnection = new EventEmitter();

  var localStreams = [];
  var remoteStreams = [];

  peerConnection.signalingState = 'stable';
  peerConnection.localDescription = null;
  peerConnection.remoteDescription = null;

  peerConnection.addEventListener = peerConnection.addListener;
  peerConnection.removeEventListener = peerConnection.removeListener;
  peerConnection.dispatchEvent = event => {
    peerConnection.emit(event.type, event);
  };

  peerConnection.setLocalDescription = (description, resolve, reject) => {
    if (options.errorScenario === 'setLocalDescription') {
      reject(new Error('Testing setLocalDescription error'));
      return;
    }
    if (peerConnection.signalingState === 'stable' &&
        description.type === 'offer') {
      peerConnection.signalingState = 'have-local-offer';
      peerConnection.emit('signalingstatechange');
    } else if (peerConnection.signalingState === 'have-remote-offer' &&
               (description.type === 'answer' || description.type === 'rollback')) {
      peerConnection.signalingState = 'stable';
      peerConnection.emit('signalingstatechange');
    }
    peerConnection.localDescription = description;
    resolve();
  };

  peerConnection.setRemoteDescription = (description, resolve, reject) => {
    if (options.errorScenario === 'setRemoteDescription') {
      reject(new Error('Testing setRemoteDescription error'));
      return;
    }
    if (peerConnection.signalingState === 'stable' &&
        description.type === 'offer') {
      peerConnection.signalingState = 'have-remote-offer';
      peerConnection.emit('signalingstatechanged');
    } else if (peerConnection.signalingState === 'have-local-offer' &&
               (description.type === 'answer' || description.type === 'rollback')) {
      peerConnection.signalingState = 'stable';
      peerConnection.emit('signalingstatechange');
    }
    peerConnection.remoteDescription = description;
    resolve();
  };

  peerConnection.createOffer = (resolve, reject) => {
    if (options.errorScenario === 'createOffer') {
      reject(new Error('Testing createOffer error'));
      return;
    }

    var offer = options.offers[offerIndex++];
    if (offer) {
      resolve(offer);
      return;
    }
    reject(new Error('Ran out of offers'));
  };

  peerConnection.createAnswer = (resolve, reject) => {
    if (options.errorScenario === 'createAnswer') {
      reject(new Error('Testing createAnswer error'));
      return;
    }

    var answer = options.answers[answerIndex++];
    if (answer) {
      resolve(answer);
      return;
    }
    reject(new Error('Ran out of answers'));
  };

  peerConnection.close = () => {
    peerConnection.signalingState = 'closed';
    peerConnection.emit('signalingstatechange');
  };

  peerConnection.addStream = stream => localStreams.push(stream);

  peerConnection.removeStream = stream => {
    var i = localStreams.indexOf(stream);
    if (i > -1) {
      localStreams.splice(i);
    }
  };

  peerConnection.getLocalStreams = () => localStreams;
  peerConnection.getRemoteStreams = () => remoteStreams;

  peerConnection.addIceCandidate = (candidate, resolve) => resolve();

  return peerConnection;
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
  var peerConnection = options.peerConnection || makePeerConnection(options);
  function RTCPeerConnection() {
    return peerConnection;
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
  var description = {
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
  var ice = {
    candidates: [],
    revision: count,
    ufrag: ufrag
  };
  for (var i = 0; i < count; i++) {
    ice.candidates.push({ candidate: 'candidate' + (i + 1) });
  }
  return ice;
}
