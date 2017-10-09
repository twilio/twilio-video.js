'use strict';

const assert = require('assert');
const EventEmitter = require('events').EventEmitter;
const { FakeMediaStream, FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const inherits = require('util').inherits;
const DataTrackSender = require('../../../../../lib/data/sender');
const { makeEncodingParameters } = require('../../../../lib/util');
const MockIceServerSource = require('../../../../lib/mockiceserversource');
const { AudioContextFactory } = require('../../../../../lib/webaudio/audiocontext');
const PeerConnectionManager = require('../../../../../lib/signaling/v2/peerconnectionmanager');
const sinon = require('sinon');
const util = require('../../../../../lib/util');

describe('PeerConnectionManager', () => {
  describe('#close', () => {
    it('returns the PeerConnectionManager', () => {
      var test = makeTest();
      var mediaStream = makeMediaStream();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        assert.equal(
          test.peerConnectionManager,
          test.peerConnectionManager.close());
      });
    });

    it('calls stop on the IceServerSource', async () => {
      const test = makeTest();
      await test.iceServerSource.start();
      test.peerConnectionManager.close();
      assert(test.iceServerSource.stop.calledOnce);
    })

    it('calls close on any PeerConnectionV2s created with #createAndOffer or #update', () => {
      var test = makeTest();
      var mediaStream = makeMediaStream();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        test.peerConnectionManager.close();
        assert(test.peerConnectionV2s[0].close.calledOnce);
        assert(test.peerConnectionV2s[1].close.calledOnce);
      });
    });

    context('when AudioContext is supported', () => {
      it('should call .stop on its underlying dummy audio MediaStreamTrack', async () => {
        const test = makeTest({ isAudioContextSupported: true });
        const dummyTrack = test.peerConnectionManager._dummyAudioMediaStreamTrack;
        const promise = new Promise(resolve => dummyTrack.addEventListener('ended', resolve));
        test.peerConnectionManager.close();
        await promise;
      });

      it('should call .release on its AudioContextFactory', () => {
        const test = makeTest({ isAudioContextSupported: true });
        test.audioContextFactory.release = sinon.spy(test.audioContextFactory.release);
        test.peerConnectionManager.close();
        sinon.assert.calledOnce(test.audioContextFactory.release);
        sinon.assert.calledWith(test.audioContextFactory.release, test.peerConnectionManager);
      });
    });
  });

  describe('#createAndOffer', () => {
    context('returns a Promise that resolves', () => {
      it('to the PeerConnectionManager', () => {
        var test = makeTest();
        return test.peerConnectionManager.createAndOffer().then(peerConnectionManager => {
          assert.equal(test.peerConnectionManager, peerConnectionManager);
        });
      });

      it('after the PeerConnectionV2 has created an offer', () => {
        var peerConnectionV2 = new EventEmitter();
        var deferred = util.defer();
        peerConnectionV2.offer = () => deferred.promise;
        var test = makeTest({
          RTCPeerConnection: function() { return peerConnectionV2; }
        });
        var createAndOfferResolved = false;
        var promise = test.peerConnectionManager.createAndOffer().then(() => {
          createAndOfferResolved = true;
        });
        return new Promise(resolve => {
          assert(!createAndOfferResolved);
          deferred.resolve();
          resolve(promise);
        });
      });
    });

    it('constructs a new PeerConnectionV2 using the most recent configuration passed to #setConfiguration', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        test.peerConnectionManager.setConfiguration({ baz: 'qux' });
      }).then(() => {
        assert.deepEqual(
          { baz: 'qux' },
          test.peerConnectionV2s[0].configuration);
      });
    });

    it('calls addMediaStream with the ._localMediaStream containing the previously-added MediaStreamTracks on the new PeerConnectionV2', () => {
      var test = makeTest();
      var mediaStream = makeMediaStream();
      test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(mediaStream.getTracks());
      return test.peerConnectionManager.createAndOffer().then(() => {
        assert.equal(
          test.peerConnectionManager._localMediaStream,
          test.peerConnectionV2s[0].addMediaStream.args[0][0]);
        assert.deepEqual(
          test.peerConnectionManager._localMediaStream.getTracks(),
          mediaStream.getTracks()
        );
      });
    });

    it('calls addDataTrackSender with the previously-added DataTrackSenders on the new PeerConnectionV2', () => {
      const test = makeTest();
      const dataTrackSender1 = new DataTrackSender(null, null, true);
      const dataTrackSender2 = new DataTrackSender(null, null, true);

      // NOTE(mroberts): First we'll add two DataTrackSenders.
      test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders([dataTrackSender1, dataTrackSender2]);

      // NOTE(mroberts): Then we'll remove one.
      test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders([dataTrackSender2]);

      return test.peerConnectionManager.createAndOffer().then(() => {
        // NOTE(mroberts): Finally we'll ensure only the DataTrackSender that remains is added.
        sinon.assert.calledOnce(test.peerConnectionV2s[0].addDataTrackSender);
        sinon.assert.calledWith(test.peerConnectionV2s[0].addDataTrackSender, dataTrackSender2);
      });
    });
  });

  describe('#getRemoteMediaStreamTracksAndDataTrackReceivers', () => {
    it('returns the concatenated results of calling getRemoteMediaStreamTracksAndDataTrackReceivers on any PeerConnectionV2s create with #createAndOffer or #update', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        var mediaStream1 = makeMediaStream({ audio: 1 });
        var mediaStream2 = makeMediaStream({ audio: 1, video: 1 });
        test.peerConnectionV2s[0].getRemoteMediaStreamTracksAndDataTrackReceivers = () => mediaStream1.getTracks();
        test.peerConnectionV2s[1].getRemoteMediaStreamTracksAndDataTrackReceivers = () => mediaStream2.getTracks();
        assert.deepEqual(getTracks([mediaStream1, mediaStream2]),
          test.peerConnectionManager.getRemoteMediaStreamTracksAndDataTrackReceivers());
      });
    });
  });

  describe('#getStates', () => {
    it('returns the non-null results of calling getState on any PeerConnectionV2s created with #createAndOffer or #update', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        test.peerConnectionV2s[0].getState = () => null;
        assert.deepEqual(
          [
            { id: '123', fizz: 'buzz' }
          ],
          test.peerConnectionManager.getStates());
      });
    });
  });

  describe('#setConfiguration', () => {
    it('returns the PeerConnectionManager', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        assert.equal(
          test.peerConnectionManager,
          test.peerConnectionManager.setConfiguration({ foo: 'bar' }));
      });
    });

    it('calls setConfiguration on any PeerConnectionV2s created with #createAndOffer or #update', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        test.peerConnectionManager.setConfiguration({ foo: 'bar' });
        assert.deepEqual(
          { foo: 'bar' },
          test.peerConnectionV2s[0].setConfiguration.args[0][0]);
        assert.deepEqual(
          { foo: 'bar' },
          test.peerConnectionV2s[1].setConfiguration.args[0][0]);
      });
    });
  });

  describe('#setMediaStreamTracksAndDataTrackSenders', () => {
    [ true, false ].forEach(isAudioContextSupported => {
      context(`when AudioContext is ${isAudioContextSupported ? '' : 'not'} supported`, () => {
        it('returns the PeerConnectionManager', () => {
          var test = makeTest({ isAudioContextSupported });
          var mediaStream1 = makeMediaStream();
          var mediaStream2 = makeMediaStream();
          var mediaStream3 = makeMediaStream();
          test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
            getTracks([mediaStream1, mediaStream2]));
          return test.peerConnectionManager.createAndOffer().then(() => {
            return test.peerConnectionManager.update([
              { id: '123' }
            ]);
          }).then(() => {
            assert.equal(
              test.peerConnectionManager,
              test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
                getTracks([mediaStream2, mediaStream3])));
          });
        });

        context('when called with the same MediaStreamTracks as the last time', () => {
          it('should not call addMediaStream on the underlying PeerConnectionV2s', () => {
            var test = makeTest({ isAudioContextSupported });
            var mediaStream1 = makeMediaStream({ audio: 1 });
            var mediaStream2 = makeMediaStream({ video: 1 });
            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
              getTracks([mediaStream1, mediaStream2]));
            return test.peerConnectionManager.createAndOffer().then(() => {
              return test.peerConnectionManager.update([
                { id: '123' }
              ]);
            }).then(() => {
              test.peerConnectionV2s[0].addMediaStream.reset();
              test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
                getTracks([mediaStream2, mediaStream1]));
              sinon.assert.notCalled(test.peerConnectionV2s[0].addMediaStream);
            });
          });
        });

        context('when called with the same DataTrackSenders as the last time', () => {
          it('should not call addDataTrackSender or removeDataTrackSender on the underlying PeerConnectionV2s', () => {
            var test = makeTest({ isAudioContextSupported });
            var dataTrackSender1 = new DataTrackSender(null, null, true);
            var dataTrackSender2 = new DataTrackSender(null, null, true);
            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
              [dataTrackSender1, dataTrackSender2]);
            return test.peerConnectionManager.createAndOffer().then(() => {
              return test.peerConnectionManager.update([
                { id: '123' }
              ]);
            }).then(() => {
              test.peerConnectionV2s[0].addDataTrackSender.reset();
              test.peerConnectionV2s[0].removeDataTrackSender.reset();
              test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
                [dataTrackSender1, dataTrackSender2]);
              sinon.assert.notCalled(test.peerConnectionV2s[0].addDataTrackSender);
              sinon.assert.notCalled(test.peerConnectionV2s[0].removeDataTrackSender);
            });
          });
        });

        it('calls addMediaStream with the ._localMediaStream containing the remaining MediaStreamTracks on any PeerConnectionV2s created with #createAndOffer or #update', () => {
          var test = makeTest({ isAudioContextSupported });
          var mediaStream1 = makeMediaStream({ audio: 1 });
          var mediaStream2 = makeMediaStream({ video: 1 });
          var mediaStream3 = makeMediaStream({ video: 1 });
          test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
            getTracks([mediaStream1, mediaStream2]));
          return test.peerConnectionManager.createAndOffer().then(() => {
            return test.peerConnectionManager.update([
              { id: '123' }
            ]);
          }).then(() => {
            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
              getTracks([mediaStream2, mediaStream3]));

            const addedMediaStreams = test.peerConnectionV2s.map(peerConnectionV2 => peerConnectionV2.addMediaStream.args[1][0]);
            const dummyAudioTrack = test.peerConnectionManager._dummyAudioMediaStreamTrack;

            assert.deepEqual(getTracks([mediaStream2, mediaStream3]),
              addedMediaStreams[0].getTracks().filter(track => dummyAudioTrack !== track));

            assert.deepEqual(getTracks([mediaStream2, mediaStream3]),
              addedMediaStreams[1].getTracks().filter(track => dummyAudioTrack !== track));
          });
        });

        it('calls addMediaStream with the ._localMediaStream containing the new MediaStreamTracks on any PeerConnectionV2s created with #createAndOffer or #update', () => {
          var test = makeTest({ isAudioContextSupported });
          var mediaStream1 = makeMediaStream({ video: 1 });
          var mediaStream2 = makeMediaStream({ audio: 1 });
          var mediaStream3 = makeMediaStream({ audio: 1 });
          test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
            getTracks([mediaStream1, mediaStream2]));
          return test.peerConnectionManager.createAndOffer().then(() => {
            return test.peerConnectionManager.update([
              { id: '123' }
            ]);
          }).then(() => {
            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
              getTracks([mediaStream2, mediaStream3]));

            const addedMediaStreams = test.peerConnectionV2s.map(peerConnectionV2 => peerConnectionV2.addMediaStream.args[1][0]);
            const dummyAudioTrack = test.peerConnectionManager._dummyAudioMediaStreamTrack;

            assert.deepEqual(getTracks([mediaStream2, mediaStream3]),
              addedMediaStreams[0].getTracks().filter(track => dummyAudioTrack !== track));

            assert.deepEqual(getTracks([mediaStream2, mediaStream3]),
              addedMediaStreams[1].getTracks().filter(track => dummyAudioTrack !== track));
          });
        });

        it('calls removeDataTrackSender with the removed DataTrackSenders on any PeerConnectionV2s created with #createAndOffer or #update', () => {
          var test = makeTest({ isAudioContextSupported });
          var dataTrackSender1 = new DataTrackSender(null, null, true);
          var dataTrackSender2 = new DataTrackSender(null, null, true);
          var dataTrackSender3 = new DataTrackSender(null, null, true);
          test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
            [dataTrackSender1, dataTrackSender2]);
          return test.peerConnectionManager.createAndOffer().then(() => {
            return test.peerConnectionManager.update([
              { id: '123' }
            ]);
          }).then(() => {
            test.peerConnectionV2s.forEach(peerConnectionV2 => peerConnectionV2.removeDataTrackSender.reset());
            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
              [dataTrackSender2, dataTrackSender3]);
            test.peerConnectionV2s.forEach(peerConnectionV2 => {
              sinon.assert.calledOnce(peerConnectionV2.removeDataTrackSender);
              sinon.assert.calledWith(peerConnectionV2.removeDataTrackSender, dataTrackSender1);
            });
          });
        });

        it('calls addDataTrackSender with the added DataTrackSenders on any PeerConnectionV2s created with #createAndOffer or #update', () => {
          var test = makeTest({ isAudioContextSupported });
          var dataTrackSender1 = new DataTrackSender(null, null, true);
          var dataTrackSender2 = new DataTrackSender(null, null, true);
          var dataTrackSender3 = new DataTrackSender(null, null, true);
          test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
            [dataTrackSender1, dataTrackSender2]);
          return test.peerConnectionManager.createAndOffer().then(() => {
            return test.peerConnectionManager.update([
              { id: '123' }
            ]);
          }).then(() => {
            test.peerConnectionV2s.forEach(peerConnectionV2 => peerConnectionV2.addDataTrackSender.reset());
            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
              [dataTrackSender2, dataTrackSender3]);
            test.peerConnectionV2s.forEach(peerConnectionV2 => {
              sinon.assert.calledOnce(peerConnectionV2.addDataTrackSender);
              sinon.assert.calledWith(peerConnectionV2.addDataTrackSender, dataTrackSender3);
            });
          });
        });

        context('when the MediaStreamTracks changed', () => {
          it('calls offer on any PeerConnectionV2s created with #createAndOffer or #update', () => {
            var test = makeTest({ isAudioContextSupported });

            var audioTrack1 = makeMediaStreamTrack({ kind: 'audio' });
            var audioTrack2 = makeMediaStreamTrack({ kind: 'audio' });
            var audioTrack3 = makeMediaStreamTrack({ kind: 'audio' });

            var mediaStream1 = makeMediaStream({
              audio: [audioTrack1]
            });

            var mediaStream2 = makeMediaStream({
              audio: [audioTrack1, audioTrack2]
            });

            var mediaStream3 = makeMediaStream({
              audio: [audioTrack2, audioTrack3]
            });

            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
              getTracks([mediaStream1, mediaStream2]));

            return test.peerConnectionManager.createAndOffer().then(() => {
              return test.peerConnectionManager.update([
                { id: '123' }
              ]);
            }).then(() => {
              test.peerConnectionV2s[0].offer = sinon.spy(() => Promise.resolve());
              test.peerConnectionV2s[1].offer = sinon.spy(() => Promise.resolve());

              test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
                getTracks([mediaStream2, mediaStream3]));

              assert(test.peerConnectionV2s[0].offer.calledOnce);
              assert(test.peerConnectionV2s[1].offer.calledOnce);
            });
          });
        });

        // TODO(mroberts): Technically, we only need to renegotiate if an
        // m=application section has not yet been negotiated. We should optimize
        // this in the future.
        context('when the DataTrackSenders changed', () => {
          it('calls offer on any PeerConnectionV2s created with #createAndOffer or #update', () => {
            var test = makeTest({ isAudioContextSupported });

            var dataTrackSender1 = new DataTrackSender(null, null, true);
            var dataTrackSender2 = new DataTrackSender(null, null, true);
            var dataTrackSender3 = new DataTrackSender(null, null, true);

            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
              [dataTrackSender1, dataTrackSender2]);

            return test.peerConnectionManager.createAndOffer().then(() => {
              return test.peerConnectionManager.update([
                { id: '123' }
              ]);
            }).then(() => {
              test.peerConnectionV2s[0].offer = sinon.spy(() => Promise.resolve());
              test.peerConnectionV2s[1].offer = sinon.spy(() => Promise.resolve());

              test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
                [dataTrackSender2, dataTrackSender3]);

              assert(test.peerConnectionV2s[0].offer.calledOnce);
              assert(test.peerConnectionV2s[1].offer.calledOnce);
            });
          });
        });

        context('when the MediaStreamTracks did not change', () => {
          it('does not call offer on any PeerConnectionV2s created with #createAndOffer or #update', () => {
            var test = makeTest({ isAudioContextSupported });

            var audioTrack1 = makeMediaStreamTrack({ kind: 'audio' });
            var audioTrack2 = makeMediaStreamTrack({ kind: 'audio' });

            var mediaStream1 = makeMediaStream({
              audio: [audioTrack1]
            });

            var mediaStream2 = makeMediaStream({
              audio: [audioTrack1, audioTrack2]
            });

            var mediaStream3 = makeMediaStream({
              audio: [audioTrack1]
            });

            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
              getTracks([mediaStream1, mediaStream2]));

            return test.peerConnectionManager.createAndOffer().then(() => {
              return test.peerConnectionManager.update([
                { id: '123' }
              ]);
            }).then(() => {
              test.peerConnectionV2s[0].offer = sinon.spy(() => Promise.resolve());
              test.peerConnectionV2s[1].offer = sinon.spy(() => Promise.resolve());

              test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
                getTracks([mediaStream2, mediaStream3]));

              assert(!test.peerConnectionV2s[0].offer.calledOnce);
              assert(!test.peerConnectionV2s[1].offer.calledOnce);
            });
          });
        });

        context('when the DataTrackSenders did not change', () => {
          it('does not call offer on any PeerConnectionV2s created with #createAndOffer or #update', () => {
            var test = makeTest({ isAudioContextSupported });

            var dataTrackSender1 = new DataTrackSender(null, null, true);
            var dataTrackSender2 = new DataTrackSender(null, null, true);

            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
              [dataTrackSender1, dataTrackSender2]);

            return test.peerConnectionManager.createAndOffer().then(() => {
              return test.peerConnectionManager.update([
                { id: '123' }
              ]);
            }).then(() => {
              test.peerConnectionV2s[0].offer = sinon.spy(() => Promise.resolve());
              test.peerConnectionV2s[1].offer = sinon.spy(() => Promise.resolve());

              test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(
                [dataTrackSender1, dataTrackSender2]);

              assert(!test.peerConnectionV2s[0].offer.calledOnce);
              assert(!test.peerConnectionV2s[1].offer.calledOnce);
            });
          });
        });
      });
    });
  });

  describe('#update', () => {
    context('when called with an array of PeerConnection states containing a new PeerConnection ID', () => {
      it('returns a Promise for the PeerConnectionManager', () => {
        var test = makeTest();
        return test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]).then(peerConnectionManager => {
          assert.equal(test.peerConnectionManager, peerConnectionManager);
        });
      });

      it('constructs a new PeerConnectionV2 with the new PeerConnection ID using the most recent configuration passed to #setConfiguration', () => {
        var test = makeTest();
        return test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]).then(() => {
          assert.equal('123', test.peerConnectionV2s[0].id);
          assert.deepEqual(
            { iceServers: [] },
            test.peerConnectionV2s[0].configuration);
        });
      });

      [ true, false ].forEach(isAudioContextSupported => {
        context(`when AudioContext is ${isAudioContextSupported ? '' : 'not'} supported`, () => {
          it(`calls addMediaStream with the ._localMediaStream containing any previously-added MediaStreamTracks ${isAudioContextSupported ? ' and the dummy audio MediaStreamTrack' : ''} on the new PeerConnectionV2`, () => {
            var test = makeTest({ isAudioContextSupported });
            var mediaStream = makeMediaStream();
            test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(mediaStream.getTracks());
            return test.peerConnectionManager.update([
              { id: '123', fizz: 'buzz' }
            ]).then(() => {
              const addedMediaStream = test.peerConnectionV2s[0].addMediaStream.args[0][0];
              const dummyAudioTrack = test.peerConnectionManager._dummyAudioMediaStreamTrack;
              assert.deepEqual(mediaStream.getTracks(),
                addedMediaStream.getTracks().filter(track => dummyAudioTrack !== track));
            });
          });
        });
      });

      it('calls addDataTrackSender with the previously-added DataTrackSenders on the new PeerConnectionV2', () => {
        const test = makeTest();
        const dataTrackSender = new DataTrackSender(null, null, true);
        test.peerConnectionManager.setMediaStreamTracksAndDataTrackSenders([dataTrackSender]);
        return test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]).then(() => {
          sinon.assert.calledOnce(test.peerConnectionV2s[0].addDataTrackSender);
          sinon.assert.calledWith(test.peerConnectionV2s[0].addDataTrackSender, dataTrackSender);
        });
      });

      it('passes the PeerConnection states to the new PeerConnectionV2\'s #update method', () => {
        var test = makeTest();
        return test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]).then(() => {
          assert.deepEqual(
            { id: '123', fizz: 'buzz' },
            test.peerConnectionV2s[0].update.args[0][0]);
        });
      });
    });

    context('when called with an array of PeerConnection states containing known PeerConnection IDs', () => {
      it('returns a Promise for the PeerConnectionManager', () => {
        var test = makeTest();
        return test.peerConnectionManager.createAndOffer().then(() => {
          var peerConnectionState = {
            id: test.peerConnectionV2s[0].id,
            fizz: 'buzz'
          };
          return test.peerConnectionManager.update([peerConnectionState]);
        }).then(peerConnectionManager => {
          assert.equal(test.peerConnectionManager, peerConnectionManager);
        });
      });

      it('passes the PeerConnection states to the corresponding PeerConnectionV2\'s #update method', () => {
        var test = makeTest();
        return test.peerConnectionManager.createAndOffer().then(() => {
          var peerConnectionState = {
            id: test.peerConnectionV2s[0].id,
            fizz: 'buzz'
          };
          return test.peerConnectionManager.update([peerConnectionState]);
        }).then(() => {
          assert.deepEqual(
            {
              id: test.peerConnectionV2s[0].id,
              fizz: 'buzz'
            },
            test.peerConnectionV2s[0].update.args[0][0]);
        });
      });
    });

    context('when it is called more than once for the same id', () => {
      it('should result in the PeerConnection having only one listener for \'stateChanged\'', () => {
        var test = makeTest();
        return test.peerConnectionManager.createAndOffer().then(() => {
          var peerConnectionState = {
            id: test.peerConnectionV2s[0].id,
            fizz: 'buzz'
          };
          return test.peerConnectionManager.update([peerConnectionState]);
        }).then(() => {
          var peerConnectionState = {
            id: test.peerConnectionV2s[0].id,
            fizz: 'jazz'
          };
          return test.peerConnectionManager.update([peerConnectionState]);
        }).then(() => {
          assert.equal(test.peerConnectionV2s[0].listenerCount('stateChanged'), 1);
        });
      });
    });
  });

  describe('"candidates" event', () => {
    it('is emitted whenever a PeerConnectionV2 created with #createAndOffer or #update emits it', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        var promise1 = new Promise(resolve => test.peerConnectionManager.once('candidates', resolve));
        test.peerConnectionV2s[0].emit('candidates', { foo: 'bar' });
        return promise1;
      }).then(result1 => {
        var promise2 = new Promise(resolve => test.peerConnectionManager.once('candidates', resolve));
        test.peerConnectionV2s[1].emit('candidates', { baz: 'qux' });
        return Promise.all([result1, promise2]);
      }).then(results => {
        assert.deepEqual(
          { foo: 'bar' },
          results[0]);
        assert.deepEqual(
          { baz: 'qux' },
          results[1]);
      });
    });
  });

  describe('"description" event', () => {
    it('is emitted whenever a PeerConnectionV2 created with #createAndOffer or #update emits it', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        var promise1 = new Promise(resolve => test.peerConnectionManager.once('description', resolve));
        test.peerConnectionV2s[0].emit('description', { foo: 'bar' });
        return promise1;
      }).then(result1 => {
        var promise2 = new Promise(resolve => test.peerConnectionManager.once('description', resolve));
        test.peerConnectionV2s[1].emit('description', { baz: 'qux' });
        return Promise.all([result1, promise2]);
      }).then(results => {
        assert.deepEqual(
          { foo: 'bar' },
          results[0]);
        assert.deepEqual(
          { baz: 'qux' },
          results[1]);
      });
    });
  });

  describe('"trackAdded" event', () => {
    it('is emitted whenever a PeerConnectionV2 created with #createAndOffer or #update emits it', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        var promise1 = new Promise(resolve => test.peerConnectionManager.once('trackAdded', resolve));
        test.peerConnectionV2s[0].emit('trackAdded', { foo: 'bar' });
        return promise1;
      }).then(result1 => {
        var promise2 = new Promise(resolve => test.peerConnectionManager.once('trackAdded', resolve));
        test.peerConnectionV2s[1].emit('trackAdded', { baz: 'qux' });
        return Promise.all([result1, promise2]);
      }).then(results => {
        assert.deepEqual(
          { foo: 'bar' },
          results[0]);
        assert.deepEqual(
          { baz: 'qux' },
          results[1]);
      });
    });
  });
});

function makeTest(options) {
  options = options || {};
  options.iceServers = options.iceServers || [];
  options.isAudioContextSupported = options.isAudioContextSupported || false;
  options.audioContextFactory = options.audioContextFactory || makeAudioContextFactory(options);
  options.MediaStream = options.MediaStream || FakeMediaStream;
  options.peerConnectionV2s = options.peerConnectionV2s || [];
  options.PeerConnectionV2 = options.PeerConnectionV2 || makePeerConnectionV2Constructor(options);

  const mockIceServerSource = new MockIceServerSource();
  options.iceServerSource = options.iceServerSource || mockIceServerSource;

  options.peerConnectionManager = options.peerConnectionManager
    || new PeerConnectionManager(
      options.iceServerSource,
      makeEncodingParameters(options),
      { audio: [], video: [] },
      options);
  options.peerConnectionManager.setConfiguration({ iceServers: [] });
  return options;
}

function makeAudioContextFactory(testOptions) {
  function AudioContext() {
    this.close = sinon.spy(() => {});
    this.createMediaStreamDestination = sinon.spy(() => {
      const getAudioTracks = sinon.spy(() => [ new FakeMediaStreamTrack('audio') ]);
      return { stream: { getAudioTracks } };
    });
  }
  const audioContextFactory = new AudioContextFactory({ AudioContext });
  return testOptions.isAudioContextSupported ? audioContextFactory : null;
}

function makePeerConnectionV2Constructor(testOptions) {
  return function PeerConnectionV2(id, encodingParameters, options) {
    var peerConnectionV2 = new EventEmitter();

    peerConnectionV2.configuration = {
      iceServers: testOptions.iceServers
    };

    peerConnectionV2.id = id;

    peerConnectionV2.addDataTrackSender = sinon.spy();

    peerConnectionV2.addMediaStream = sinon.spy();

    peerConnectionV2.close = sinon.spy();

    peerConnectionV2.offer = sinon.spy(() => Promise.resolve());

    peerConnectionV2.getState = () => ({
      id: id,
      fizz: 'buzz'
    });

    peerConnectionV2.removeDataTrackSender = sinon.spy();

    peerConnectionV2.removeMediaStream = sinon.spy();

    peerConnectionV2.setConfiguration = sinon.spy(configuration => {
      peerConnectionV2.configuration = configuration;
    });

    peerConnectionV2.update = sinon.spy(() => Promise.resolve());

    testOptions.peerConnectionV2s.push(peerConnectionV2);

    return peerConnectionV2;
  };
}

function getTracks(mediaStreams) {
  return mediaStreams.reduce(function(mediaStreamTracks, mediaStream) {
    return mediaStreamTracks.concat(mediaStream.getTracks());
  }, []);
}

function makeId() {
  return Math.floor(Math.random() * 100 + 0.5);
}

function makeMediaStream(options) {
  options = options || {};
  options.id = options.id || makeId();
  options.audio = options.audio || 0;
  options.video = options.video || 0;

  if (typeof options.audio === 'number') {
    var audio = [];
    for (var i = 0; i < options.audio; i++) {
      var audioTrack = makeMediaStreamTrack({ kind: 'audio' });
      audio.push(audioTrack);
    }
    options.audio = audio;
  }

  if (typeof options.video === 'number') {
    var video = [];
    for (var i = 0; i < options.video; i++) {
      var videoTrack = makeMediaStreamTrack({ kind: 'video' });
      video.push(videoTrack);
    }
    options.video = video;
  }

  options.audio = options.audio.map(track => track instanceof MediaStreamTrack
    ? track : new MediaStreamTrack(track));

  options.video = options.video.map(track => track instanceof MediaStreamTrack
    ? track : new MediaStreamTrack(track));

  var mediaStream = new EventEmitter();

  mediaStream.addEventListener = mediaStream.addListener;

  mediaStream.removeEventListener = mediaStream.removeListener;

  mediaStream.getAudioTracks = () => options.audio;

  mediaStream.getVideoTracks = () => options.video;

  mediaStream.getTracks = () => options.audio.concat(options.video);

  return mediaStream;
}

function MediaStreamTrack(options) {
  options = options || {};
  this.id = options.id || makeId();
  this.kind = options.kind;
  EventEmitter.call(this);
}

inherits(MediaStreamTrack, EventEmitter);

MediaStreamTrack.prototype.addEventListener = MediaStreamTrack.prototype.addListener;

MediaStreamTrack.prototype.removeEventListener = MediaStreamTrack.prototype.removeListener;

function makeMediaStreamTrack(options) {
  return new MediaStreamTrack(options);
}
