'use strict';

var assert = require('assert');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var Track = require('../../../../../lib/media/track');
var LocalAudioTrack = require('../../../../../lib/media/track/localaudiotrack');
var LocalVideoTrack = require('../../../../../lib/media/track/localvideotrack');
var sinon = require('sinon');
var log = require('../../../../lib/fakelog');

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
    var track;

    describe('.isStopped', () => {
      it('should set .isStopped based on the state of the MediaStreamTrack\'s .readyState property', () => {
        track = createTrack(LocalTrack, '1', kind[description]);
        track.mediaStreamTrack.readyState = 'ended';
        assert(track.isStopped);
        track.mediaStreamTrack.readyState = 'live';
        assert(!track.isStopped);
      });
    });

    describe('"trackStopped" event', () => {
      context('when the MediaStreamTrack emits onended event', () => {
        it('should emit Track#stopped, passing the instance of Track', () => {
          track = createTrack(LocalTrack, '1', kind[description]);

          const stoppedEvent = new Promise((resolve, reject) => {
            track.on('stopped', function(_track) {
              try {
                assert.equal(track, _track);
              } catch (error) {
                reject(error);
                return;
              }
              resolve();
            });
          });

          assert(track.mediaStreamTrack.readyState !== 'ended');

          track.mediaStreamTrack.emit('ended');

          return stoppedEvent;
        });
      });
    });

    describe('#stop', function() {
      var dummyElement = {
        oncanplay: null,
        videoWidth: 320,
        videoHeight: 240
      };

      before(function() {
        track = createTrack(LocalTrack, '1', kind[description]);
        track._createElement = sinon.spy(() => dummyElement);
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

function createTrack(LocalTrack, id, kind) {
  var mediaStreamTrack = new MediaStreamTrack(id, kind);
  return new LocalTrack(mediaStreamTrack, { log: log });
}

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
