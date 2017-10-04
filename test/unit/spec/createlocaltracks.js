'use strict';

var assert = require('assert');
var createLocalTracks = require('../../../lib/createlocaltracks');
var fakeGetUserMedia = require('../../lib/fakemediastream').fakeGetUserMedia;
var FakeMediaStreamTrack = require('../../lib/fakemediastream').FakeMediaStreamTrack;
var sinon = require('sinon');

describe('createLocalTracks', () => {
  [
    [ 'when called with no constraints' ],
    [ 'when called with { audio: true, video: true }', { audio: true, video: true } ]
  ].forEach(scenario => {
    context(scenario[0], () => {
      it('should resolve with a LocalAudioTrack and a LocalVideoTrack', () => {
        var options = makeOptions();
        if (scenario[1]) {
          options = Object.assign(scenario[1], options);
        }

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
    [ 'when called with { audio: true }', { audio: true } ],
    [ 'when called with { audio: true, video: false }', { audio: true, video: false } ]
  ].forEach(scenario => {
    context(scenario[0], () => {
      it('should resolve with a LocalAudioTrack', () => {
        var options = makeOptions();
        if (scenario[1]) {
          options = Object.assign(scenario[1], options);
        }

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
    [ 'when called with { video: true }', { video: true } ],
    [ 'when called with { audio: false, video: true }', { audio: false, video: true } ]
  ].forEach(scenario => {
    context(scenario[0], () => {
      it('should resolve with a LocalVideoTrack', () => {
        var options = makeOptions();
        if (scenario[1]) {
          options = Object.assign(scenario[1], options);
        }

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
      var options = Object.assign({
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
      assert.deepEqual(localTracks.map(track => track.name), [ 'foo', 'bar' ]);
    });
  });
});

function makeOptions() {
  return {
    getUserMedia: fakeGetUserMedia,
    LocalAudioTrack: sinon.spy(function(mediaStreamTrack, options) {
      options = options || {};
      this.id = mediaStreamTrack.id;
      this.kind = mediaStreamTrack.kind;
      this.mediaStreamTrack = mediaStreamTrack;
      this.name = options.name || mediaStreamTrack.id;
    }),
    LocalVideoTrack: sinon.spy(function(mediaStreamTrack, options) {
      options = options || {};
      this.id = mediaStreamTrack.id;
      this.kind = mediaStreamTrack.kind;
      this.mediaStreamTrack = mediaStreamTrack;
      this.name = options.name || mediaStreamTrack.id;
    }),
    MediaStreamTrack: FakeMediaStreamTrack
  };
}
