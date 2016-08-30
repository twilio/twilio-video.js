'use strict';

var assert = require('assert');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var Track = require('../../../../../lib/media/track');
var LocalAudioTrack = require('../../../../../lib/media/track/localaudiotrack');
var LocalVideoTrack = require('../../../../../lib/media/track/localvideotrack');
var sinon = require('sinon');

[
  ['LocalAudioTrack', LocalAudioTrack],
  ['LocalVideoTrack', LocalVideoTrack]
].forEach(pair => {
  var description = pair[0];
  var LocalTrack = pair[1];
  var kind = {
    LocalAudioTrack: 'audio',
    LocalVideoTrack: 'video'
  };

  describe(description, function() {
    var _end;
    var _initialize;
    var mediaStream;
    var track;

    before(function() {
      _end = Track.prototype._end;
      _initialize = LocalTrack.prototype._initialize;
      Track.prototype._end = sinon.spy();
      LocalTrack.prototype._initialize = sinon.spy();
    });

    after(function() {
      Track.prototype._end = _end;
      LocalTrack.prototype._initialize = _initialize;
    });

    describe('#stop', function() {
      var dummyElement = {
        oncanplay: null,
        videoWidth: 320,
        videoHeight: 240
      };

      before(function() {
        mediaStream = new MediaStream();
        track = createTrack(LocalTrack, mediaStream, '1', kind[description]);
        track._createElement = sinon.spy(() => dummyElement);
        _initialize.call(track);
      });

      it('should not change the value of isEnabled', (done) => {
        var startedTimeout = setTimeout(
          done.bind(null, new Error('track#started didn\'t fire')),
          1000
        );
        track.on('started', () => {
          var isEnabled = track.isEnabled;
          clearTimeout(startedTimeout);
          track.stop();
          assert.equal(isEnabled, track.isEnabled);
          done();
        });
        track.emit('started', track);
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

MediaStreamTrack.prototype.stop = function stop() {
  // Simulating the browser-native MediaStreamTrack's 'ended' event
  this.emit('ended', {type: 'ended'});
};
