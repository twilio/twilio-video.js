'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { inherits } = require('util');

const DataTrackSender = require('../../../../../lib/data/sender');
const PeerConnectionManager = require('../../../../../lib/signaling/v2/peerconnectionmanager');
const { defer } = require('../../../../../lib/util');
const { AudioContextFactory } = require('../../../../../lib/webaudio/audiocontext');

const { FakeMediaStream, FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const MockIceServerSource = require('../../../../lib/mockiceserversource');
const { makeEncodingParameters } = require('../../../../lib/util');

describe('PeerConnectionManager', () => {
  describe('.iceConnectionState', () => {
    describe('when there are zero RTCPeerConnections', () => {
      const test = makeTest();
      assert.equal(test.peerConnectionManager.iceConnectionState, 'new');
    });

    describe('when there is one RTCPeerConnection', () => {
      it('equals the RTCPeerConnection\'s ICE connection state', async () => {
        await Promise.all([
          'new',
          'checking',
          'connected',
          'completed',
          'disconnected',
          'closed'
        ].map(async state => {
          const test = makeTest();
          await test.peerConnectionManager.createAndOffer();
          test.peerConnectionV2s[0].iceConnectionState = state;
          test.peerConnectionV2s[0].emit('iceConnectionStateChanged');
          assert.equal(test.peerConnectionManager.iceConnectionState, state);
        }));
      });
    });

    describe('when there are 2 RTCPeerConnections', () => {
      [
        ['new', 'new', 'new'],
        ['new', 'checking', 'checking'],
        ['new', 'connected', 'connected'],
        ['new', 'completed', 'completed'],
        ['new', 'disconnected', 'new'],
        ['new', 'failed', 'new'],
        ['new', 'closed', 'new'],
        ['checking', 'checking', 'checking'],
        ['checking', 'connected', 'connected'],
        ['checking', 'completed', 'completed'],
        ['checking', 'disconnected', 'checking'],
        ['checking', 'failed', 'checking'],
        ['checking', 'closed', 'checking'],
        ['connected', 'connected', 'connected'],
        ['connected', 'completed', 'completed'],
        ['connected', 'disconnected', 'connected'],
        ['connected', 'failed', 'connected'],
        ['connected', 'closed', 'connected'],
        ['completed', 'completed', 'completed'],
        ['completed', 'disconnected', 'completed'],
        ['completed', 'failed', 'completed'],
        ['completed', 'closed', 'completed'],
        ['disconnected', 'disconnected', 'disconnected'],
        ['disconnected', 'failed', 'disconnected'],
        ['disconnected', 'closed', 'disconnected'],
        ['failed', 'failed', 'failed'],
        ['failed', 'closed', 'failed'],
        ['closed', 'closed', 'closed'],
      ].forEach(([state1, state2, expected]) => {
        describe(`with ICE connection states "${state1}" and "${state2}"`, () => {
          it(`equals ${expected}`, async () => {
            const test = makeTest();
            await test.peerConnectionManager.createAndOffer();
            await test.peerConnectionManager.createAndOffer();
            test.peerConnectionV2s[0].iceConnectionState = state1;
            test.peerConnectionV2s[1].iceConnectionState = state2;
            test.peerConnectionV2s[0].emit('iceConnectionStateChanged');
            test.peerConnectionV2s[1].emit('iceConnectionStateChanged');
            assert.equal(test.peerConnectionManager.iceConnectionState, expected);
          });
        });
      });
    });
  });

  describe('"iceConnectionStateChanged"', () => {
    it('emits only when the summarized ICE connection state changes', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();

      // It should emit if a single PeerConnectionV2's .iceConnectionState changes.
      let didEmit = false;
      test.peerConnectionV2s[0].iceConnectionState = 'checking';
      test.peerConnectionManager.once('iceConnectionStateChanged', () => { didEmit = true; });
      test.peerConnectionV2s[0].emit('iceConnectionStateChanged');
      assert(didEmit);
      assert.equal(test.peerConnectionManager.iceConnectionState, 'checking');

      await test.peerConnectionManager.createAndOffer();

      // It should not emit if a second PeerConnectionV2's .iceConnectionState
      // changes in a way that does not effect the summarized ICE connection
      // state.
      didEmit = false;
      test.peerConnectionManager.once('iceConnectionStateChanged', () => { didEmit = true; });
      test.peerConnectionV2s[1].iceConnectionState = 'checking';
      test.peerConnectionV2s[1].emit('iceConnectionStateChanged');
      assert(!didEmit);
      assert.equal(test.peerConnectionManager.iceConnectionState, 'checking');

      // However, if a second PeerConnectionV2's .iceConnectionState does cause
      // a change in the summarized ICE connection state, it _should_ emit
      // "iceConnectionStateChanged".
      test.peerConnectionV2s[1].iceConnectionState = 'connected';
      test.peerConnectionV2s[1].emit('iceConnectionStateChanged');
      assert(didEmit);
      assert.equal(test.peerConnectionManager.iceConnectionState, 'connected');

      // Test a third PeerConnectionV2.
      didEmit = false;
      test.peerConnectionManager.once('iceConnectionStateChanged', () => { didEmit = true; });
      await test.peerConnectionManager.createAndOffer();
      test.peerConnectionV2s[2].iceConnectionState = 'completed';
      test.peerConnectionV2s[2].emit('iceConnectionStateChanged');
      assert(didEmit);
      assert.equal(test.peerConnectionManager.iceConnectionState, 'completed');

      // If a PeerConnectionV2's closing affects the summarized ICE connection
      // state, then it should emit.
      didEmit = false;
      test.peerConnectionManager.once('iceConnectionStateChanged', () => { didEmit = true; });
      test.peerConnectionV2s[2].state = 'closed';
      test.peerConnectionV2s[2].emit('stateChanged', 'closed');
      assert(didEmit);
      assert.equal(test.peerConnectionManager.iceConnectionState, 'connected');

      // If a PeerConnectionV2's closing does not affect the summarized ICE
      // connection state, then it should _not_ emit.
      didEmit = false;
      test.peerConnectionManager.once('iceConnectionStateChanged', () => { didEmit = true; });
      test.peerConnectionV2s[0].state = 'closed';
      test.peerConnectionV2s[0].emit('stateChanged', 'closed');
      assert(!didEmit);
      assert.equal(test.peerConnectionManager.iceConnectionState, 'connected');

      // Once the last PeerConnectionV2 is closed, and the summarized ICE
      // connection state was not "new", it should emit in the "new" state.
      test.peerConnectionV2s[1].state = 'closed';
      test.peerConnectionV2s[1].emit('stateChanged', 'closed');
      assert(didEmit);
      assert.equal(test.peerConnectionManager.iceConnectionState, 'new');

      // If, when the last PeerConnectionV2 is closed, and the summarized ICE
      // connection state is already "new", it should not emit.
      await test.peerConnectionManager.createAndOffer();
      didEmit = false;
      test.peerConnectionManager.once('iceConnectionStateChanged', () => { didEmit = true; });
      test.peerConnectionV2s[3].state = 'closed';
      test.peerConnectionV2s[3].emit('stateChanged', 'closed');
      assert(!didEmit);
      assert.equal(test.peerConnectionManager.iceConnectionState, 'new');
    });
  });

  describe('#close', () => {
    it('returns the PeerConnectionManager', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();
      await test.peerConnectionManager.update([
        { id: '123' }
      ]);
      assert.equal(test.peerConnectionManager, test.peerConnectionManager.close());
    });

    it('calls stop on the IceServerSource', async () => {
      const test = makeTest();
      await test.iceServerSource.start();
      test.peerConnectionManager.close();
      assert(test.iceServerSource.stop.calledOnce);
    });

    it('calls close on any PeerConnectionV2s created with #createAndOffer or #update', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();
      await test.peerConnectionManager.update([
        { id: '123' }
      ]);

      test.peerConnectionManager.close();
      sinon.assert.calledOnce(test.peerConnectionV2s[0].close);
      sinon.assert.calledOnce(test.peerConnectionV2s[1].close);
    });

    context('when AudioContext is supported', () => {
      it('should call .stop on its underlying dummy audio MediaStreamTrack', async () => {
        const test = makeTest({ isAudioContextSupported: true });
        const dummyTrack = test.peerConnectionManager._dummyAudioTrackSender.track;
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
      it('to the PeerConnectionManager', async () => {
        const test = makeTest();
        const peerConnectionManager = await test.peerConnectionManager.createAndOffer();
        assert.equal(test.peerConnectionManager, peerConnectionManager);
      });

      it('after the PeerConnectionV2 has created an offer', () => {
        const peerConnectionV2 = new EventEmitter();
        const deferred = defer();
        peerConnectionV2.offer = () => deferred.promise;
        const test = makeTest({
          RTCPeerConnection: function() { return peerConnectionV2; }
        });
        let createAndOfferResolved;
        const promise = test.peerConnectionManager.createAndOffer().then(() => {
          createAndOfferResolved = true;
        });
        return new Promise(resolve => {
          assert(!createAndOfferResolved);
          deferred.resolve();
          resolve(promise);
        });
      });
    });

    it('constructs a new PeerConnectionV2 using the most recent configuration passed to #setConfiguration', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();
      test.peerConnectionManager.setConfiguration({ baz: 'qux' });
      assert.deepEqual({ baz: 'qux' }, test.peerConnectionV2s[0].configuration);
    });

    it('calls addMediaTrackSender with previously-added MediaTrackSenders on the new PeerConnectionV2', async () => {
      const test = makeTest();
      const mediaStream = makeMediaStream();
      test.peerConnectionManager.setTrackSenders(mediaStream.getTracks().map(makeTrackSender));
      await test.peerConnectionManager.createAndOffer();
      assert.deepEqual(mediaStream.getTracks(), test.peerConnectionV2s[0].addMediaTrackSender.args.map(([trackSender]) => trackSender.track));
    });

    it('calls addDataTrackSender with the previously-added DataTrackSenders on the new PeerConnectionV2', async () => {
      const test = makeTest();
      const dataTrackSender1 = new DataTrackSender(null, null, true);
      const dataTrackSender2 = new DataTrackSender(null, null, true);

      // NOTE(mroberts): First we'll add two DataTrackSenders.
      test.peerConnectionManager.setTrackSenders([dataTrackSender1, dataTrackSender2]);

      // NOTE(mroberts): Then we'll remove one.
      test.peerConnectionManager.setTrackSenders([dataTrackSender2]);

      await test.peerConnectionManager.createAndOffer();

      // NOTE(mroberts): Finally we'll ensure only the DataTrackSender that remains is added.
      sinon.assert.calledOnce(test.peerConnectionV2s[0].addDataTrackSender);
      sinon.assert.calledWith(test.peerConnectionV2s[0].addDataTrackSender, dataTrackSender2);
    });
  });

  describe('#getTrackReceivers', () => {
    it('returns the concatenated results of calling getTrackReceivers on any PeerConnectionV2s create with #createAndOffer or #update', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();
      await test.peerConnectionManager.update([
        { id: '123' }
      ]);

      const mediaStream1 = makeMediaStream({ audio: 1 });
      const mediaStream2 = makeMediaStream({ audio: 1, video: 1 });
      test.peerConnectionV2s[0].getTrackReceivers = () => mediaStream1.getTracks();
      test.peerConnectionV2s[1].getTrackReceivers = () => mediaStream2.getTracks();
      assert.deepEqual(getTracks([mediaStream1, mediaStream2]), test.peerConnectionManager.getTrackReceivers());
    });
  });

  describe('#getStates', () => {
    it('returns the non-null results of calling getState on any PeerConnectionV2s created with #createAndOffer or #update', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();
      await test.peerConnectionManager.update([
        { id: '123' }
      ]);

      test.peerConnectionV2s[0].getState = () => null;
      assert.deepEqual([{ id: '123', fizz: 'buzz' }], test.peerConnectionManager.getStates());
    });
  });

  describe('#setConfiguration', () => {
    it('returns the PeerConnectionManager', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();
      await test.peerConnectionManager.update([
        { id: '123' }
      ]);
      assert.equal(test.peerConnectionManager, test.peerConnectionManager.setConfiguration({ foo: 'bar' }));
    });

    it('calls setConfiguration on any PeerConnectionV2s created with #createAndOffer or #update', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();
      await test.peerConnectionManager.update([
        { id: '123' }
      ]);

      test.peerConnectionManager.setConfiguration({ foo: 'bar' });
      assert.deepEqual({ foo: 'bar' }, test.peerConnectionV2s[0].setConfiguration.args[0][0]);
      assert.deepEqual({ foo: 'bar' }, test.peerConnectionV2s[1].setConfiguration.args[0][0]);
    });
  });

  describe('#setTrackSenders', () => {
    [true, false].forEach(isAudioContextSupported => {
      context(`when AudioContext is ${isAudioContextSupported ? '' : 'not '}supported`, () => {
        it('returns the PeerConnectionManager', async () => {
          const test = makeTest({ isAudioContextSupported });
          const mediaStream1 = makeMediaStream();
          const mediaStream2 = makeMediaStream();
          const mediaStream3 = makeMediaStream();
          const trackSenders1 = mediaStream1.getTracks().map(makeTrackSender);
          const trackSenders2 = mediaStream2.getTracks().map(makeTrackSender);
          const trackSenders3 = mediaStream3.getTracks().map(makeTrackSender);

          test.peerConnectionManager.setTrackSenders([...trackSenders1, ...trackSenders2]);
          await test.peerConnectionManager.createAndOffer();
          await test.peerConnectionManager.update([
            { id: '123' }
          ]);

          assert.equal(test.peerConnectionManager,
            test.peerConnectionManager.setTrackSenders([...trackSenders2, ...trackSenders3]));
        });

        context('when called with the same MediaTrackSenders as the last time', () => {
          it('should not call addMediaTrackSender on the underlying PeerConnectionV2s', async () => {
            const test = makeTest({ isAudioContextSupported });
            const mediaStream1 = makeMediaStream({ audio: 1 });
            const mediaStream2 = makeMediaStream({ video: 1 });
            const trackSenders1 = mediaStream1.getTracks().map(makeTrackSender);
            const trackSenders2 = mediaStream2.getTracks().map(makeTrackSender);

            test.peerConnectionManager.setTrackSenders([...trackSenders1, ...trackSenders2]);
            await test.peerConnectionManager.createAndOffer();
            await test.peerConnectionManager.update([
              { id: '123' }
            ]);

            test.peerConnectionV2s[0].addMediaTrackSender.reset();
            test.peerConnectionManager.setTrackSenders([...trackSenders1, ...trackSenders2]);
            sinon.assert.notCalled(test.peerConnectionV2s[0].addMediaTrackSender);
          });
        });

        context('when called with the same DataTrackSenders as the last time', () => {
          it('should not call addDataTrackSender or removeDataTrackSender on the underlying PeerConnectionV2s', async () => {
            const test = makeTest({ isAudioContextSupported });
            const dataTrackSender1 = new DataTrackSender(null, null, true);
            const dataTrackSender2 = new DataTrackSender(null, null, true);
            test.peerConnectionManager.setTrackSenders([dataTrackSender1, dataTrackSender2]);

            await test.peerConnectionManager.createAndOffer();
            await test.peerConnectionManager.update([
              { id: '123' }
            ]);

            test.peerConnectionV2s[0].addDataTrackSender.reset();
            test.peerConnectionV2s[0].removeDataTrackSender.reset();
            test.peerConnectionManager.setTrackSenders([dataTrackSender1, dataTrackSender2]);
            sinon.assert.notCalled(test.peerConnectionV2s[0].addDataTrackSender);
            sinon.assert.notCalled(test.peerConnectionV2s[0].removeDataTrackSender);
          });
        });

        it('calls addMediaTrackSender for the new MediaTrackSenders and removeMediaTrackSender for the removed MediaTrackSenders on any PeerConnectionV2s created with #createAndOffer or #update', async () => {
          const test = makeTest({ isAudioContextSupported });
          const mediaStream1 = makeMediaStream({ audio: 1 });
          const mediaStream2 = makeMediaStream({ video: 1 });
          const mediaStream3 = makeMediaStream({ video: 1 });
          const trackSenders1 = mediaStream1.getTracks().map(makeTrackSender);
          const trackSenders2 = mediaStream2.getTracks().map(makeTrackSender);
          const trackSenders3 = mediaStream3.getTracks().map(makeTrackSender);

          test.peerConnectionManager.setTrackSenders([...trackSenders1, ...trackSenders2]);
          await test.peerConnectionManager.createAndOffer();
          await test.peerConnectionManager.update([
            { id: '123' }
          ]);

          test.peerConnectionV2s.forEach(peerConnectionV2 => peerConnectionV2.addMediaTrackSender.reset());
          test.peerConnectionV2s.forEach(peerConnectionV2 => peerConnectionV2.addMediaTrackSender.reset());
          test.peerConnectionManager.setTrackSenders([...trackSenders2, ...trackSenders3]);

          const addMediaTrackSenderArgs = test.peerConnectionV2s.map(peerConnectionV2 => peerConnectionV2.addMediaTrackSender.args.map(([sender]) => sender.track));
          const removeMediaTrackSenderArgs = test.peerConnectionV2s.map(peerConnectionV2 => peerConnectionV2.removeMediaTrackSender.args.map(([sender]) => sender.track));
          const dummyAudioTrack = (test.peerConnectionManager._dummyAudioTrackSender || { track: null }).track;

          addMediaTrackSenderArgs.forEach(addedMediaTracks => {
            assert.deepEqual(addedMediaTracks.filter(track => dummyAudioTrack !== track), mediaStream3.getTracks());
          });
          removeMediaTrackSenderArgs.forEach(removedMediaTracks => {
            assert.deepEqual(removedMediaTracks.filter(track => dummyAudioTrack !== track), mediaStream1.getTracks());
          });
        });

        it('calls removeDataTrackSender with the removed DataTrackSenders on any PeerConnectionV2s created with #createAndOffer or #update', async () => {
          const test = makeTest({ isAudioContextSupported });
          const dataTrackSender1 = new DataTrackSender(null, null, true);
          const dataTrackSender2 = new DataTrackSender(null, null, true);
          const dataTrackSender3 = new DataTrackSender(null, null, true);
          test.peerConnectionManager.setTrackSenders([dataTrackSender1, dataTrackSender2]);

          await test.peerConnectionManager.createAndOffer();
          await test.peerConnectionManager.update([
            { id: '123' }
          ]);

          test.peerConnectionV2s.forEach(peerConnectionV2 => peerConnectionV2.removeDataTrackSender.reset());
          test.peerConnectionManager.setTrackSenders([dataTrackSender2, dataTrackSender3]);
          test.peerConnectionV2s.forEach(peerConnectionV2 => {
            sinon.assert.calledOnce(peerConnectionV2.removeDataTrackSender);
            sinon.assert.calledWith(peerConnectionV2.removeDataTrackSender, dataTrackSender1);
          });
        });

        it('calls addDataTrackSender with the added DataTrackSenders on any PeerConnectionV2s created with #createAndOffer or #update', async () => {
          const test = makeTest({ isAudioContextSupported });
          const dataTrackSender1 = new DataTrackSender(null, null, true);
          const dataTrackSender2 = new DataTrackSender(null, null, true);
          const dataTrackSender3 = new DataTrackSender(null, null, true);
          test.peerConnectionManager.setTrackSenders([dataTrackSender1, dataTrackSender2]);

          await test.peerConnectionManager.createAndOffer();
          await test.peerConnectionManager.update([
            { id: '123' }
          ]);

          test.peerConnectionV2s.forEach(peerConnectionV2 => peerConnectionV2.addDataTrackSender.reset());
          test.peerConnectionManager.setTrackSenders([dataTrackSender2, dataTrackSender3]);
          test.peerConnectionV2s.forEach(peerConnectionV2 => {
            sinon.assert.calledOnce(peerConnectionV2.addDataTrackSender);
            sinon.assert.calledWith(peerConnectionV2.addDataTrackSender, dataTrackSender3);
          });
        });

        context('when the MediaTrackSenders changed', () => {
          it('calls offer on any PeerConnectionV2s created with #createAndOffer or #update', async () => {
            const test = makeTest({ isAudioContextSupported });

            const audioTrack1 = makeMediaStreamTrack({ kind: 'audio' });
            const audioTrack2 = makeMediaStreamTrack({ kind: 'audio' });
            const audioTrack3 = makeMediaStreamTrack({ kind: 'audio' });

            const mediaStream1 = makeMediaStream({
              audio: [audioTrack1]
            });

            const mediaStream2 = makeMediaStream({
              audio: [audioTrack1, audioTrack2]
            });

            const mediaStream3 = makeMediaStream({
              audio: [audioTrack2, audioTrack3]
            });


            const trackSenders1 = mediaStream1.getTracks().map(makeTrackSender);
            const trackSenders2 = mediaStream2.getTracks().map(makeTrackSender);
            const trackSenders3 = mediaStream3.getTracks().map(makeTrackSender);

            test.peerConnectionManager.setTrackSenders([...trackSenders1, ...trackSenders2]);
            await test.peerConnectionManager.createAndOffer();
            await test.peerConnectionManager.update([
              { id: '123' }
            ]);

            test.peerConnectionV2s[0].offer = sinon.spy(() => Promise.resolve());
            test.peerConnectionV2s[1].offer = sinon.spy(() => Promise.resolve());
            test.peerConnectionManager.setTrackSenders([...trackSenders2, ...trackSenders3]);

            sinon.assert.calledOnce(test.peerConnectionV2s[0].offer);
            sinon.assert.calledOnce(test.peerConnectionV2s[1].offer);
          });
        });

        context('when the DataTrackSenders changed', () => {
          it('should not call offer on any PeerConnectionV2s created with #createAndOffer or #update', async () => {
            const test = makeTest({ isAudioContextSupported });

            const dataTrackSender1 = new DataTrackSender(null, null, true);
            const dataTrackSender2 = new DataTrackSender(null, null, true);
            const dataTrackSender3 = new DataTrackSender(null, null, true);

            test.peerConnectionManager.setTrackSenders([dataTrackSender1, dataTrackSender2]);

            await test.peerConnectionManager.createAndOffer();
            await test.peerConnectionManager.update([
              { id: '123' }
            ]);

            test.peerConnectionV2s[0].offer = sinon.spy(() => Promise.resolve());
            test.peerConnectionV2s[1].offer = sinon.spy(() => Promise.resolve());

            test.peerConnectionManager.setTrackSenders([dataTrackSender2, dataTrackSender3]);

            assert(test.peerConnectionV2s[0].offer.notCalled);
            assert(test.peerConnectionV2s[1].offer.notCalled);
          });
        });

        context('when the MediaTrackSenders did not change', () => {
          it('does not call offer on any PeerConnectionV2s created with #createAndOffer or #update', async () => {
            const test = makeTest({ isAudioContextSupported });

            const audioTrack1 = makeMediaStreamTrack({ kind: 'audio' });
            const audioTrack2 = makeMediaStreamTrack({ kind: 'audio' });

            const mediaStream1 = makeMediaStream({
              audio: [audioTrack1]
            });

            const mediaStream2 = makeMediaStream({
              audio: [audioTrack1, audioTrack2]
            });


            const trackSenders1 = mediaStream1.getTracks().map(makeTrackSender);
            const trackSenders2 = mediaStream2.getTracks().map(makeTrackSender);

            test.peerConnectionManager.setTrackSenders([...trackSenders1, ...trackSenders2]);
            await test.peerConnectionManager.createAndOffer();
            await test.peerConnectionManager.update([
              { id: '123' }
            ]);

            test.peerConnectionV2s[0].offer = sinon.spy(() => Promise.resolve());
            test.peerConnectionV2s[1].offer = sinon.spy(() => Promise.resolve());
            test.peerConnectionManager.setTrackSenders([...trackSenders1, ...trackSenders2]);

            sinon.assert.notCalled(test.peerConnectionV2s[0].offer);
            sinon.assert.notCalled(test.peerConnectionV2s[1].offer);
          });
        });

        context('when the DataTrackSenders did not change', () => {
          it('does not call offer on any PeerConnectionV2s created with #createAndOffer or #update', async () => {
            const test = makeTest({ isAudioContextSupported });

            const dataTrackSender1 = new DataTrackSender(null, null, true);
            const dataTrackSender2 = new DataTrackSender(null, null, true);

            test.peerConnectionManager.setTrackSenders([dataTrackSender1, dataTrackSender2]);

            await test.peerConnectionManager.createAndOffer();
            await test.peerConnectionManager.update([
              { id: '123' }
            ]);

            test.peerConnectionV2s[0].offer = sinon.spy(() => Promise.resolve());
            test.peerConnectionV2s[1].offer = sinon.spy(() => Promise.resolve());

            test.peerConnectionManager.setTrackSenders([dataTrackSender1, dataTrackSender2]);

            assert(!test.peerConnectionV2s[0].offer.calledOnce);
            assert(!test.peerConnectionV2s[1].offer.calledOnce);
          });
        });
      });
    });
  });

  describe('#update', () => {
    context('when called with an array of PeerConnection states containing a new PeerConnection ID', () => {
      it('returns a Promise for the PeerConnectionManager', async () => {
        const test = makeTest();
        const peerConnectionManager = await test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]);
        assert.equal(test.peerConnectionManager, peerConnectionManager);
      });

      it('constructs a new PeerConnectionV2 with the new PeerConnection ID using the most recent configuration passed to #setConfiguration', async () => {
        const test = makeTest();
        await test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]);

        assert.equal('123', test.peerConnectionV2s[0].id);
        assert.deepEqual({ iceServers: [] }, test.peerConnectionV2s[0].configuration);
      });

      [true, false].forEach(isAudioContextSupported => {
        context(`when AudioContext is ${isAudioContextSupported ? '' : 'not'} supported`, () => {
          it('calls addMediaTrackSender for the MediaTrackSenders containing any previously-added MediaStreamTracks on the new PeerConnectionV2', async () => {
            const test = makeTest({ isAudioContextSupported });
            const mediaStream = makeMediaStream({ video: 1 });
            const trackSenders = mediaStream.getTracks().map(makeTrackSender);

            test.peerConnectionManager.setTrackSenders(trackSenders);
            await test.peerConnectionManager.update([
              { id: '123', fizz: 'buzz' }
            ]);

            const addedMediaTracks = test.peerConnectionV2s[0].addMediaTrackSender.args.map(([sender]) => sender.track);
            assert.deepEqual(addedMediaTracks, mediaStream.getTracks());
          });
        });
      });

      it('calls addDataTrackSender with the previously-added DataTrackSenders on the new PeerConnectionV2', async () => {
        const test = makeTest();
        const dataTrackSender = new DataTrackSender(null, null, true);

        test.peerConnectionManager.setTrackSenders([dataTrackSender]);
        await test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]);

        sinon.assert.calledOnce(test.peerConnectionV2s[0].addDataTrackSender);
        sinon.assert.calledWith(test.peerConnectionV2s[0].addDataTrackSender, dataTrackSender);
      });

      it('passes the PeerConnection states to the new PeerConnectionV2\'s #update method', async () => {
        const test = makeTest();
        await test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]);

        assert.deepEqual(
          { id: '123', fizz: 'buzz' },
          test.peerConnectionV2s[0].update.args[0][0]);
      });
    });

    context('when called with an array of PeerConnection states containing known PeerConnection IDs', () => {
      it('returns a Promise for the PeerConnectionManager', async () => {
        const test = makeTest();
        await test.peerConnectionManager.createAndOffer();

        const peerConnectionState = {
          id: test.peerConnectionV2s[0].id,
          fizz: 'buzz'
        };

        const peerConnectionManager = await test.peerConnectionManager.update([peerConnectionState]);
        assert.equal(test.peerConnectionManager, peerConnectionManager);
      });

      it('passes the PeerConnection states to the corresponding PeerConnectionV2\'s #update method', async () => {
        const test = makeTest();
        await test.peerConnectionManager.createAndOffer();

        const peerConnectionState = {
          id: test.peerConnectionV2s[0].id,
          fizz: 'buzz'
        };

        await test.peerConnectionManager.update([peerConnectionState]);
        assert.deepEqual(
          {
            id: test.peerConnectionV2s[0].id,
            fizz: 'buzz'
          },
          test.peerConnectionV2s[0].update.args[0][0]);
      });
    });

    context('when called with an array of PeerConnection states where some PeerConnection IDs are no longer present', () => {
      [false, true].forEach(synced => {
        context(`and the PeerConnection states are part of a ${synced ? '"synced"' : '"connected" or "update"'} message`, () => {
          it('returns a Promise for the PeerConnectionManager', async () => {
            const test = makeTest();
            await test.peerConnectionManager.createAndOffer();
            await test.peerConnectionManager.createAndOffer();

            const peerConnectionState = {
              id: test.peerConnectionV2s[0].id,
              fizz: 'buzz'
            };

            const peerConnectionManager = await test.peerConnectionManager.update([peerConnectionState]);
            assert.equal(test.peerConnectionManager, peerConnectionManager);
          });

          it(`${synced ? 'closes' : 'does not close'} those PeerConnections whose IDs are not present in the array`, async () => {
            const test = makeTest();
            await test.peerConnectionManager.createAndOffer();
            await test.peerConnectionManager.createAndOffer();

            const peerConnectionState = {
              id: test.peerConnectionV2s[0].id,
              fizz: 'buzz'
            };

            await test.peerConnectionManager.update([peerConnectionState], synced);
            if (synced) {
              sinon.assert.calledOnce(test.peerConnectionV2s[1]._close);
            } else {
              sinon.assert.notCalled(test.peerConnectionV2s[1]._close);
            }
          });

          it('passes the PeerConnection states to the corresponding PeerConnectionV2\'s #update method', async () => {
            const test = makeTest();
            await test.peerConnectionManager.createAndOffer();
            await test.peerConnectionManager.createAndOffer();

            const peerConnectionState = {
              id: test.peerConnectionV2s[0].id,
              fizz: 'buzz'
            };

            await test.peerConnectionManager.update([peerConnectionState]);
            assert.deepEqual(
              {
                id: test.peerConnectionV2s[0].id,
                fizz: 'buzz'
              },
              test.peerConnectionV2s[0].update.args[0][0]);
            sinon.assert.notCalled(test.peerConnectionV2s[1].update);
          });
        });
      });
    });

    context('when it is called more than once for the same id', () => {
      it('should result in the PeerConnection having only one listener for \'stateChanged\'', async () => {
        const test = makeTest();
        await test.peerConnectionManager.createAndOffer();

        let peerConnectionState = {
          id: test.peerConnectionV2s[0].id,
          fizz: 'buzz'
        };
        await test.peerConnectionManager.update([peerConnectionState]);

        peerConnectionState = {
          id: test.peerConnectionV2s[0].id,
          fizz: 'jazz'
        };
        await test.peerConnectionManager.update([peerConnectionState]);

        assert.equal(test.peerConnectionV2s[0].listenerCount('stateChanged'), 1);
      });
    });
  });

  describe('"candidates" event', () => {
    it('is emitted whenever a PeerConnectionV2 created with #createAndOffer or #update emits it', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();
      await test.peerConnectionManager.update([
        { id: '123' }
      ]);

      const promise1 = new Promise(resolve => test.peerConnectionManager.once('candidates', resolve));
      test.peerConnectionV2s[0].emit('candidates', { foo: 'bar' });
      const result1 = await promise1;

      const promise2 = new Promise(resolve => test.peerConnectionManager.once('candidates', resolve));
      test.peerConnectionV2s[1].emit('candidates', { baz: 'qux' });
      const results = await Promise.all([result1, promise2]);

      assert.deepEqual({ foo: 'bar' }, results[0]);
      assert.deepEqual({ baz: 'qux' }, results[1]);
    });
  });

  describe('"description" event', () => {
    it('is emitted whenever a PeerConnectionV2 created with #createAndOffer or #update emits it', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();
      await test.peerConnectionManager.update([
        { id: '123' }
      ]);

      const promise1 = new Promise(resolve => test.peerConnectionManager.once('description', resolve));
      test.peerConnectionV2s[0].emit('description', { foo: 'bar' });
      const result1 = await promise1;

      const promise2 = new Promise(resolve => test.peerConnectionManager.once('description', resolve));
      test.peerConnectionV2s[1].emit('description', { baz: 'qux' });
      const results = await Promise.all([result1, promise2]);

      assert.deepEqual({ foo: 'bar' }, results[0]);
      assert.deepEqual({ baz: 'qux' }, results[1]);
    });
  });

  describe('"trackAdded" event', () => {
    it('is emitted whenever a PeerConnectionV2 created with #createAndOffer or #update emits it', async () => {
      const test = makeTest();
      await test.peerConnectionManager.createAndOffer();
      await test.peerConnectionManager.update([
        { id: '123' }
      ]);

      const promise1 = new Promise(resolve => test.peerConnectionManager.once('trackAdded', resolve));
      test.peerConnectionV2s[0].emit('trackAdded', { foo: 'bar' });
      const result1 = await promise1;

      const promise2 = new Promise(resolve => test.peerConnectionManager.once('trackAdded', resolve));
      test.peerConnectionV2s[1].emit('trackAdded', { baz: 'qux' });
      const results = await Promise.all([result1, promise2]);

      assert.deepEqual({ foo: 'bar' }, results[0]);
      assert.deepEqual({ baz: 'qux' }, results[1]);
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
      const getAudioTracks = sinon.spy(() => [new FakeMediaStreamTrack('audio')]);
      return { stream: { getAudioTracks } };
    });
  }
  const audioContextFactory = new AudioContextFactory({ AudioContext });
  return testOptions.isAudioContextSupported ? audioContextFactory : null;
}

function makePeerConnectionV2Constructor(testOptions) {
  return function PeerConnectionV2(id) {
    const peerConnectionV2 = new EventEmitter();

    peerConnectionV2.configuration = {
      iceServers: testOptions.iceServers
    };

    peerConnectionV2._close = sinon.spy();

    peerConnectionV2.id = id;

    peerConnectionV2.addDataTrackSender = sinon.spy(() => {
      peerConnectionV2.isApplicationSectionNegotiated = true;
    });

    peerConnectionV2.addMediaTrackSender = sinon.spy();

    peerConnectionV2.close = sinon.spy();

    peerConnectionV2.offer = sinon.spy(() => Promise.resolve());

    peerConnectionV2.getState = () => ({
      id: id,
      fizz: 'buzz'
    });

    peerConnectionV2.iceConnectionState = 'new';

    peerConnectionV2.isApplicationSectionNegotiated = false;

    peerConnectionV2.removeDataTrackSender = sinon.spy();

    peerConnectionV2.removeMediaTrackSender = sinon.spy();

    peerConnectionV2.setConfiguration = sinon.spy(configuration => {
      peerConnectionV2.configuration = configuration;
    });

    peerConnectionV2.update = sinon.spy(() => Promise.resolve());

    testOptions.peerConnectionV2s.push(peerConnectionV2);

    return peerConnectionV2;
  };
}

function getTracks(mediaStreams) {
  return mediaStreams.reduce((mediaStreamTracks, mediaStream) => {
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
    const audio = [];
    for (let i = 0; i < options.audio; i++) {
      const audioTrack = makeMediaStreamTrack({ kind: 'audio' });
      audio.push(audioTrack);
    }
    options.audio = audio;
  }

  if (typeof options.video === 'number') {
    const video = [];
    for (let i = 0; i < options.video; i++) {
      const videoTrack = makeMediaStreamTrack({ kind: 'video' });
      video.push(videoTrack);
    }
    options.video = video;
  }

  options.audio = options.audio.map(track => track instanceof MediaStreamTrack
    ? track : new MediaStreamTrack(track));

  options.video = options.video.map(track => track instanceof MediaStreamTrack
    ? track : new MediaStreamTrack(track));

  const mediaStream = new EventEmitter();

  mediaStream.addEventListener = mediaStream.addListener;

  mediaStream.removeEventListener = mediaStream.removeListener;

  mediaStream.getAudioTracks = () => options.audio;

  mediaStream.getVideoTracks = () => options.video;

  mediaStream.getTracks = () => options.audio.concat(options.video);

  return mediaStream;
}

function makeTrackSender(track) {
  const { id, kind } = track;
  return { id, kind, track };
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
