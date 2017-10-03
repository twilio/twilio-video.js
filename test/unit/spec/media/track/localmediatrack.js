'use strict';

var assert = require('assert');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var Track = require('../../../../../lib/media/track/mediatrack');
var LocalAudioTrack = require('../../../../../lib/media/track/localaudiotrack');
var LocalVideoTrack = require('../../../../../lib/media/track/localvideotrack');
var sinon = require('sinon');
var log = require('../../../../lib/fakelog');

[
  ['LocalAudioTrack', LocalAudioTrack],
  ['LocalVideoTrack', LocalVideoTrack]
].forEach(pair => {
  var description = pair[0];
  var LocalMediaTrack = pair[1];
  var kind = {
    LocalAudioTrack: 'audio',
    LocalVideoTrack: 'video'
  };

  describe(description, function() {
    var track;

    describe('constructor', () => {
      var mediaStreamTrack;

      before(() => {
        mediaStreamTrack = new MediaStreamTrack('foo', kind[description]);
      });

      context('when called without the "options" argument', () => {
        [
          [
            'when called without the "new" keyword',
            () => LocalMediaTrack(mediaStreamTrack)
          ],
          [
            'when called with the "new" keyword',
            () => new LocalMediaTrack(mediaStreamTrack)
          ]
        ].forEach(([ scenario, createLocalMediaTrack ]) => {
          context(scenario, () => {
            it('should not throw', () => {
              assert.doesNotThrow(createLocalMediaTrack);
            });

            it(`should return an instance of ${description}`, () => {
              assert(createLocalMediaTrack() instanceof LocalMediaTrack);
            });
          });
        });
      });
    });

    describe('.isEnabled', () => {
      it('should set the .isEnabled to the MediaStreamTrack\'s .enabled property', () => {
        track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
        assert.equal(track.isEnabled, track.mediaStreamTrack.enabled);
        track.mediaStreamTrack.enabled = !track.mediaStreamTrack.enabled;
        assert.equal(track.isEnabled, track.mediaStreamTrack.enabled);
      });
    });

    describe('.isStopped', () => {
      it('should set .isStopped based on the state of the MediaStreamTrack\'s .readyState property', () => {
        track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
        track.mediaStreamTrack.readyState = 'ended';
        assert(track.isStopped);
        track.mediaStreamTrack.readyState = 'live';
        assert(!track.isStopped);
      });
    });

    describe('.name', () => {
      [true, false].forEach(isNamePresentInOptions => {
        context(`when .name is ${isNamePresentInOptions ? '' : 'not '}present in LocalTrackOptions`, () => {
          it(`should set .name to ${isNamePresentInOptions ? 'LocalTrackOptions\' .name' : 'MediaStreamTrack\'s ID'}`, () => {
            track = isNamePresentInOptions
              ? createLocalMediaTrack(LocalMediaTrack, '1', kind[description], 'foo')
              : createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
            assert.equal(track.name, isNamePresentInOptions ? 'foo' : '1');
          });
        });
      });
    });

    describe('"trackStopped" event', () => {
      context('when the MediaStreamTrack emits onended event', () => {
        it('should emit LocalMediaTrack#stopped, passing the instance of LocalMediaTrack', () => {
          track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);

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

    describe('#disable', () => {
      before(() => {
        track = createLocalMediaTrack(LocalMediaTrack, 'foo', kind[description]);
        track.enable = sinon.spy();
        track.disable();
      });

      it('should call .enable with false', () => {
        sinon.assert.calledWith(track.enable, false);
      });
    });

    describe('#enable', () => {
      context('when called with the same boolean value as the underlying MediaStreamTrack\'s .enabled', () => {
        var trackDisabledEmitted = false;
        var trackEnabledEmitted = false;

        before(() => {
          track =  createLocalMediaTrack(LocalMediaTrack, 'foo', kind[description]);
          track.mediaStreamTrack.enabled = Math.random() > 0.5;
          track.on('disabled', () => trackDisabledEmitted = true);
          track.on('enabled', () => trackEnabledEmitted = true);
        });

        it('should not emit the "disabled" or "enabled" events', () => {
          track.enable(track.mediaStreamTrack.enabled);
          assert(!(trackDisabledEmitted || trackEnabledEmitted));
        });
      });

      [ true, false ].forEach(enabled => {
        context(`when .enable is called with ${enabled}`, () => {
          context(`and the underlying MediaStreamTrack's .enabled is ${!enabled}`, () => {
            var eventEmitted = false;

            before(() => {
              track =  createLocalMediaTrack(LocalMediaTrack, 'foo', kind[description]);
              track.mediaStreamTrack.enabled = !enabled;
              track.on(enabled ? 'enabled' : 'disabled', () => eventEmitted = true);
              track.enable(enabled);
            });

            it(`should set the underlying MediaStreamTrack's .enabled to ${enabled}`, () => {
              assert.equal(track.mediaStreamTrack.enabled, enabled);
            });

            it(`should emit the ${enabled ? 'enabled' : 'disabled'} event`, () => {
              assert(eventEmitted);
            });
          });
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
        track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
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

function createLocalMediaTrack(LocalMediaTrack, id, kind, name) {
  var mediaStreamTrack = new MediaStreamTrack(id, kind);
  var options = name ? { log, name } : { log };
  return new LocalMediaTrack(mediaStreamTrack, options);
}

function MediaStreamTrack(id, kind) {
  EventEmitter.call(this);

  Object.defineProperties(this, {
    id: { value: id },
    kind: { value: kind },
    enabled: { value: true, writable: true }
  });
}

inherits(MediaStreamTrack, EventEmitter);

MediaStreamTrack.prototype.addEventListener = MediaStreamTrack.prototype.addListener;

MediaStreamTrack.prototype.removeEventListener = MediaStreamTrack.prototype.removeListener;

MediaStreamTrack.prototype.stop = function stop() {
  // Simulating the browser-native MediaStreamTrack's 'ended' event
  this.emit('ended', {type: 'ended'});
};
