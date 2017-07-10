'use strict';

if (typeof window === 'undefined') {
  require('../../lib/mockwebrtc')();
}

const assert = require('assert');
const createLocalTracks = require('../../../lib/createlocaltrack');

const isChrome = typeof webkitRTCPeerConnection !== 'undefined';
const isFirefox = typeof mozRTCPeerConnection !== 'undefined';
const isSafari = !isChrome && !isFirefox && navigator.userAgent.match(/AppleWebKit\/(\d+)\./);

['audio', 'video'].forEach(kind => {
  const createLocalTrack = createLocalTracks[kind];
  const description = 'Local' + kind[0].toUpperCase() + kind.slice(1) + 'Track';

  (navigator.userAgent === 'Node'
    ? describe.skip
    : describe
  )(description, () => {
    let localTrack = null;

    beforeEach(() => {
      return createLocalTrack().then(_localTrack => {
        localTrack = _localTrack;
      });
    });

    afterEach(() => {
      localTrack.stop();
      localTrack = null;
    });

    describe('.isStopped', () => {
      context('before calling #stop', () => {
        it('.isStopped is false', () => {
          assert(!localTrack.isStopped);
        });
      });

      context('after calling #stop', () => {
        beforeEach(() => {
          localTrack.stop();
        });

        it('.isStopped is true', () => {
          assert(localTrack.isStopped);
        });
      });

      context('when the underlying MediaStreamTrack ends', () => {
        beforeEach(() => {
          localTrack.mediaStreamTrack.stop();
        });

        it('.isStopped is true', () => {
          assert(localTrack.isStopped);
        });
      });
    });

    describe('"stopped" event', () => {
      let stoppedEvent = null;

      beforeEach(() => {
        stoppedEvent = new Promise(resolve => {
          localTrack.once('stopped', resolve);
        });
      });

      afterEach(() => {
        stoppedEvent = null;
      });

      context('when #stop is called', () => {
        it('emits "stopped"', () => {
          localTrack.stop();
          return stoppedEvent;
        });
      });

      context('when the underlying MediaStreamTrack ends', () => {
        (isFirefox || isSafari ? it.skip : it)('emits "stopped"', () => {
          localTrack.mediaStreamTrack.stop();
          return stoppedEvent;
        });
      });
    });
  });
});
