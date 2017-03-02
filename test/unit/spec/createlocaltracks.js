var assert = require('assert');
var createLocalTracks = require('../../../lib/createlocaltracks');
var fakeGetUserMedia = require('../../lib/fakemediastream').fakeGetUserMedia;
var sinon = require('sinon');

describe('createLocalTracks', () => {
  [
    [ 'when called with no constraints' ],
    [ 'when called with { audio: true }', { audio: true } ],
    [ 'when called with { video: true }', { video: true } ],
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
          assert(options.LocalAudioTrack.calledWith(tracks[0].mediaStream, tracks[0].mediaStreamTrack));
          assert(tracks[1] instanceof options.LocalVideoTrack);
          assert(options.LocalVideoTrack.calledWith(tracks[1].mediaStream, tracks[1].mediaStreamTrack));
        });
      });
    });

  });

  context('when called with { audio: true, video: false }', () => {
    it('should resolve with a LocalAudioTrack', () => {
      var options = Object.assign({
        audio: true,
        video: false
      }, makeOptions());

      return createLocalTracks(options).then(tracks => {
        assert.equal(tracks.length, 1);
        assert(tracks[0] instanceof options.LocalAudioTrack);
        assert(options.LocalAudioTrack.calledWith(tracks[0].mediaStream, tracks[0].mediaStreamTrack));
      });
    });
  });

  context('when called with { audio: false, video: true }', () => {
    it('should resolve with a LocalVideoTrack', () => {
      var options = Object.assign({
        audio: false,
        video: true
      }, makeOptions());

      return createLocalTracks(options).then(tracks => {
        assert.equal(tracks.length, 1);
        assert(tracks[0] instanceof options.LocalVideoTrack);
        assert(options.LocalVideoTrack.calledWith(tracks[0].mediaStream, tracks[0].mediaStreamTrack));
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
});

function makeOptions() {
  return {
    getUserMedia: fakeGetUserMedia,
    LocalAudioTrack: sinon.spy(function(mediaStream, mediaStreamTrack) {
      this.id = mediaStreamTrack.id;
      this.kind = mediaStreamTrack.kind;
      this.mediaStream = mediaStream;
      this.mediaStreamTrack = mediaStreamTrack;
    }),
    LocalVideoTrack: sinon.spy(function(mediaStream, mediaStreamTrack) {
      this.id = mediaStreamTrack.id;
      this.kind = mediaStreamTrack.kind;
      this.mediaStream = mediaStream;
      this.mediaStreamTrack = mediaStreamTrack;
    })
  };
}