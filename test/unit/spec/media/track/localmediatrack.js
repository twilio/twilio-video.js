'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { inherits } = require('util');

const LocalAudioTrack = require('../../../../../lib/media/track/localaudiotrack');
const LocalVideoTrack = require('../../../../../lib/media/track/localvideotrack');

const log = require('../../../../lib/fakelog');

[
  ['LocalAudioTrack', LocalAudioTrack],
  ['LocalVideoTrack', LocalVideoTrack]
].forEach(([description, LocalMediaTrack]) => {
  const kind = {
    LocalAudioTrack: 'audio',
    LocalVideoTrack: 'video'
  };

  describe(description, () => {
    let track;

    describe('constructor', () => {
      let mediaStreamTrack;

      before(() => {
        mediaStreamTrack = new MediaStreamTrack('foo', kind[description]);
      });

      context('when called without the "options" argument', () => {
        it(`should return an instance of ${description}`, () => {
          assert(new LocalMediaTrack(mediaStreamTrack) instanceof LocalMediaTrack);
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
      context('when .name is not a string', () => {
        it('should set .name to the stringified version of the property', () => {
          const notAString = { foo: 'bar' };
          track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description], notAString);
          assert.equal(track.name, String(notAString));
        });
      });

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
        it('should emit LocalMediaTrack#stopped, passing the instance of LocalMediaTrack', async () => {
          track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);

          const stoppedEvent = new Promise(resolve => track.once('stopped', resolve));

          assert(track.mediaStreamTrack.readyState !== 'ended');

          track.mediaStreamTrack.emit('ended');

          const _track = await stoppedEvent;
          assert.equal(track, _track);
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
        let trackDisabledEmitted;
        let trackEnabledEmitted;

        before(() => {
          track =  createLocalMediaTrack(LocalMediaTrack, 'foo', kind[description]);
          track.mediaStreamTrack.enabled = Math.random() > 0.5;
          track.on('disabled', () => { trackDisabledEmitted = true; });
          track.on('enabled', () => { trackEnabledEmitted = true; });
        });

        it('should not emit the "disabled" or "enabled" events', () => {
          track.enable(track.mediaStreamTrack.enabled);
          assert(!(trackDisabledEmitted || trackEnabledEmitted));
        });
      });

      [true, false].forEach(enabled => {
        context(`when .enable is called with ${enabled}`, () => {
          context(`and the underlying MediaStreamTrack's .enabled is ${!enabled}`, () => {
            let eventEmitted;

            before(() => {
              track =  createLocalMediaTrack(LocalMediaTrack, 'foo', kind[description]);
              track.mediaStreamTrack.enabled = !enabled;
              track.on(enabled ? 'enabled' : 'disabled', () => { eventEmitted = true; });
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

    describe('#stop', () => {
      const dummyElement = {
        oncanplay: null,
        videoWidth: 320,
        videoHeight: 240
      };

      before(() => {
        track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
        track._createElement = sinon.spy(() => dummyElement);
      });

      it('should not change the value of isEnabled', (done) => {
        const startedTimeout = setTimeout(
          done.bind(null, new Error('track#started didn\'t fire')),
          1000
        );
        track.on('started', () => {
          const isEnabled = track.isEnabled;
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
  const mediaStreamTrack = new MediaStreamTrack(id, kind);
  const options = name ? { log, name } : { log };
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
  this.emit('ended', { type: 'ended' });
};
