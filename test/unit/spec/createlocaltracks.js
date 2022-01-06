'use strict';

const assert = require('assert');
const sinon = require('sinon');

const createLocalTracks = require('../../../lib/createlocaltracks');

const { FakeMediaStreamTrack, fakeGetUserMedia } = require('../../lib/fakemediastream');

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
