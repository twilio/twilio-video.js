'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { FakeMediaStreamTrack, fakeGetUserMedia } from '../../lib/fakemediastream';
import { createLocalTracks, setDefaultEventObserver } from '../../../lib/createlocaltracks';

describe('createLocalTracks', () => {
  [
    ['when called with no constraints'],
    ['when called with { audio: true, video: true }', { audio: true, video: true }]
  ].forEach(([description, extraOptions]) => {
    context(description, () => {
      it('should resolve with a LocalAudioTrack and a LocalVideoTrack', () => {
        const options = Object.assign(makeOptions(), extraOptions);
        return createLocalTracks(options).then(tracks => {
          assert.equal(tracks.length, 2);
          assert(tracks[0] instanceof options.LocalAudioTrack);
          assert(tracks[0].name, tracks[0].id);
          assert(options.LocalAudioTrack.calledWith(tracks[0].mediaStreamTrack));
          assert(tracks[1] instanceof options.LocalVideoTrack);
          assert(options.LocalVideoTrack.calledWith(tracks[1].mediaStreamTrack));
          assert(tracks[1].name, tracks[1].id);
        });
      });
    });
  });

  [
    ['when called with { audio: true }', { audio: true }],
    ['when called with { audio: true, video: false }', { audio: true, video: false }]
  ].forEach(([description, extraOptions]) => {
    context(description, () => {
      it('should resolve with a LocalAudioTrack', () => {
        const options = Object.assign(makeOptions(), extraOptions);
        return createLocalTracks(options).then(tracks => {
          assert.equal(tracks.length, 1);
          assert(tracks[0] instanceof options.LocalAudioTrack);
          assert(options.LocalAudioTrack.calledWith(tracks[0].mediaStreamTrack));
          assert(tracks[0].name, tracks[0].id);
        });
      });
    });
  });

  [
    ['when called with { video: true }', { video: true }],
    ['when called with { audio: false, video: true }', { audio: false, video: true }]
  ].forEach(([description, extraOptions]) => {
    context(description, () => {
      it('should resolve with a LocalVideoTrack', () => {
        const options = Object.assign(makeOptions(), extraOptions);
        return createLocalTracks(options).then(tracks => {
          assert.equal(tracks.length, 1);
          assert(tracks[0] instanceof options.LocalVideoTrack);
          assert(options.LocalVideoTrack.calledWith(tracks[0].mediaStreamTrack));
          assert(tracks[0].name, tracks[0].id);
        });
      });
    });
  });

  context('when called with { audio: false, video: false }', () => {
    it('should resolve with an empty array', () => {
      const options = Object.assign({
        audio: false,
        video: false
      }, makeOptions());
      return createLocalTracks(options).then(tracks => {
        assert.equal(tracks.length, 0);
      });
    });
  });

  context('when called with names for the requested LocalTracks', () => {
    it('should resolve with an array of LocalTracks with the given names', async () => {
      const options = Object.assign({
        audio: { name: 'foo' },
        video: { name: 'bar' }
      }, makeOptions());
      const localTracks = await createLocalTracks(options);
      assert.deepEqual(localTracks.map(track => track.name), ['foo', 'bar']);
    });
  });

  context('when called with workaroundWebKitBug1208516', () => {
    it('should pass the option for LocalAudioTrack', async () => {
      const options = Object.assign({
        audio: { name: 'audio', workaroundWebKitBug1208516: true },
        video: { name: 'video', workaroundWebKitBug1208516: true }
      }, makeOptions());

      const localTracks = await createLocalTracks(options);
      const audioTrack = localTracks.find(track => track.name === 'audio');
      assert.equal(audioTrack.workaroundWebKitBug1208516, true);
    });
  });

  [
    { audio: true },
    { audio: {} },
    { audio: { defaultDeviceCaptureMode: 'auto' } },
    { audio: { defaultDeviceCaptureMode: 'manual' } },
    { audio: { defaultDeviceCaptureMode: 'foo' } }
  ].forEach((options: any) => {
    const { audio: audioOptions } = options;

    context(`when called with ${JSON.stringify(options)}`, () => {
      let createLocalTracksOptions: any;
      let error: any;
      let localTracks: any;

      before(async () => {
        createLocalTracksOptions = Object.assign({}, options, makeOptions());
        try {
          localTracks = await createLocalTracks(createLocalTracksOptions);
        } catch (e) {
          error = e;
        }
      });

      it(`should ${audioOptions.defaultDeviceCaptureMode === 'foo' ? '' : 'not '}throw a RangeError`, () => {
        if (audioOptions.defaultDeviceCaptureMode === 'foo') {
          assert(error instanceof RangeError);
          assert.equal(typeof localTracks, 'undefined');
        } else {
          assert(Array.isArray(localTracks));
          assert.equal(typeof error, 'undefined');
        }
      });

      it(`should ${audioOptions.defaultDeviceCaptureMode === 'foo' ? 'not call the LocalAudioTrack constructor' : `call the LocalAudioTrack constructor with defaultDeviceCaptureMode = "${audioOptions.defaultDeviceCaptureMode || 'auto'}"`}`, () => {
        if (audioOptions.defaultDeviceCaptureMode === 'foo') {
          sinon.assert.notCalled(createLocalTracksOptions.LocalAudioTrack);
        } else {
          assert.equal(createLocalTracksOptions.LocalAudioTrack.args[0][1].defaultDeviceCaptureMode, audioOptions.defaultDeviceCaptureMode || 'auto');
        }
      });
    });
  });

  context('when passing custom WebRTC overrides', () => {
    it('should use the custom getUserMedia implementation if provided', async () => {
      const options = makeOptions();
      const getUserMediaSpy = sinon.spy((options.getUserMedia));
      const expectedConstraints = {
        audio: {
          deviceId: {
            exact: 'foo'
          }
        },
        video: {
          deviceId: {
            exact: 'bar'
          }
        },
      };
      await createLocalTracks({ ...options, ...expectedConstraints, getUserMedia: getUserMediaSpy });
      assert(getUserMediaSpy.calledOnce);
      const callArgs = getUserMediaSpy.getCall(0).args;
      assert.equal(callArgs.length, 1);
      assert.deepEqual(callArgs[0], expectedConstraints, 'getUserMedia was not called with the expected constraints');
    });
  });

  describe('eventObserver integration', () => {
    afterEach(() => {
      setDefaultEventObserver();
    });

    it('should reuse the default eventObserver for successes', async () => {
      const observer = {
        emit: sinon.spy()
      };
      setDefaultEventObserver(observer as any);

      const options = makeOptions();
      await createLocalTracks(options);

      sinon.assert.calledOnce(observer.emit);
      sinon.assert.calledWith(observer.emit, 'event', {
        group: 'get-user-media',
        name: 'succeeded',
        level: 'info',
      });
    });

    it('should identify permission denied errors and emit denied event', async () => {
      const observer = {
        emit: sinon.spy()
      };
      setDefaultEventObserver(observer as any);

      const options = makeOptions();
      const permissionError = new Error('Permission denied');
      permissionError.name = 'NotAllowedError';
      options.getUserMedia = sinon.stub().rejects(permissionError);

      await assert.rejects(() => createLocalTracks(options), permissionError);

      sinon.assert.calledOnce(observer.emit);
      sinon.assert.calledWith(observer.emit, 'event', {
        group: 'get-user-media',
        name: 'denied',
        level: 'info',
      });
    });

    it('should emit failed event for generic failures', async () => {
      const observer = {
        emit: sinon.spy()
      };
      setDefaultEventObserver(observer as any);

      const options = makeOptions();
      const unexpectedError = new Error('Camera in use');
      unexpectedError.name = 'NotReadableError';
      options.getUserMedia = sinon.stub().rejects(unexpectedError);

      await assert.rejects(() => createLocalTracks(options), unexpectedError);

      sinon.assert.calledOnce(observer.emit);
      sinon.assert.calledWith(observer.emit, 'event', {
        group: 'get-user-media',
        name: 'failed',
        level: 'info',
        payload: {
          name: 'NotReadableError',
          message: 'Camera in use'
        }
      });
    });

    it('should prefer an explicitly provided eventObserver over the default', async () => {
      const defaultObserver = {
        emit: sinon.spy()
      };
      const scopedObserver = {
        emit: sinon.spy()
      };

      setDefaultEventObserver(defaultObserver as any);

      const options = Object.assign({
        eventObserver: scopedObserver
      }, makeOptions());

      await createLocalTracks(options);

      sinon.assert.calledOnce(scopedObserver.emit);
      sinon.assert.calledWith(scopedObserver.emit, 'event', {
        group: 'get-user-media',
        name: 'succeeded',
        level: 'info',
      });
      sinon.assert.notCalled(defaultObserver.emit);
    });
  });
});

function makeOptions() {
  return {
    getUserMedia: fakeGetUserMedia,
    LocalAudioTrack: sinon.spy(function LocalAudioTrack(mediaStreamTrack, options) {
      options = options || {};
      this.id = mediaStreamTrack.id;
      this.kind = mediaStreamTrack.kind;
      this.mediaStreamTrack = mediaStreamTrack;
      this.name = options.name || mediaStreamTrack.id;
      this.workaroundWebKitBug1208516 = options.workaroundWebKitBug1208516;
    }),
    LocalVideoTrack: sinon.spy(function LocalVideoTrack(mediaStreamTrack, options) {
      options = options || {};
      this.id = mediaStreamTrack.id;
      this.kind = mediaStreamTrack.kind;
      this.mediaStreamTrack = mediaStreamTrack;
      this.name = options.name || mediaStreamTrack.id;
    }),
    MediaStreamTrack: FakeMediaStreamTrack
  };
}
