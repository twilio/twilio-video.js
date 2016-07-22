'use strict';

var assert = require('assert');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var LocalAudioTrack = require('../../../../../lib/media/track/localaudiotrack');
var LocalVideoTrack = require('../../../../../lib/media/track/localvideotrack');
var sinon = require('sinon');

[
  ['LocalAudioTrack', LocalAudioTrack],
  ['LocalVideoTrack', LocalVideoTrack]
].forEach(pair => {
  var description = pair[0];
  var LocalTrack = pair[1];

  describe(description, function() {
    var _initialize;
    var mediaStream;
    var track;

    before(function() {
      _initialize = LocalTrack.prototype._initialize;
      LocalTrack.prototype._initialize = sinon.spy();
    });

    after(function() {
      LocalTrack.prototype._initialize = _initialize;
    });

    describe('_initialize', function() {
      var dummyElement;

      before(function() {
        mediaStream = new MediaStream();
        track = createTrack(LocalTrack, mediaStream, '1', 'audio');
        track._attach = sinon.spy();
        track._detachElement = sinon.spy();

        dummyElement = { oncanplay: 'bar' };
        track._createElement = sinon.spy(function() {
          return dummyElement;
        });

        _initialize.call(track);
      });

      context('when the underlying MediaStreamTrack emits ended event', function() {
        it('should emit Track#ended event', function(done) {
          track.on('ended', function() { done(); });
          track.mediaStreamTrack.emit('ended');
        });

        it('should call ._detachElement with the dummy element', function() {
          assert(track._detachElement.calledWith(dummyElement));
        });

        it('should set the element\'s oncanplay callback to null', function() {
          assert.equal(dummyElement.oncanplay, null);
        });
      });
    });
  });
});

function createTrack(LocalTrack, mediaStream, id, kind) {
  var mediaStreamTrack = new MediaStreamTrack(id, kind);
  mediaStream._tracks[kind].set(id, mediaStreamTrack);
  return new LocalTrack(mediaStream, mediaStreamTrack);
}

function MediaStream() {
  var tracks = {
    audio: new Map(),
    video: new Map()
  };

  Object.defineProperties(this, {
    _tracks: { get: function() { return tracks; } },
    getAudioTracks: {
      value: function() { return tracks.audio; }
    },
    getVideoTracks: {
      value: function() { return tracks.video; }
    },
    getTracks: {
      value: function() { return tracks.video.concat(tracks.audio); }
    },
  });
};

function MediaStreamTrack(id, kind) {
  EventEmitter.call(this);

  Object.defineProperties(this, {
    id: { value: id },
    kind: { value: kind }
  });
}

inherits(MediaStreamTrack, EventEmitter);

MediaStreamTrack.prototype.addEventListener = MediaStreamTrack.prototype.addListener;

MediaStreamTrack.prototype.removeEventListener = MediaStreamTrack.prototype.removeListener;
