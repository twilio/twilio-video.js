'use strict';

// VIDEO-14942: silence-driven re-acquires on iOS while another app holds the microphone.

const assert = require('assert');
const sinon = require('sinon');
const mock = require('mock-require');

const Document = require('../../../../lib/document');
const log = require('../../../../lib/fakelog');
const { fakeGetUserMedia, FakeMediaStreamTrack: MediaStreamTrack } = require('../../../../lib/fakemediastream');
const { waitForSometime } = require('../../../../lib/util');

const LIB = '../../../../../lib';
const MODULES = [
  `${LIB}/media/track/localmediatrack`,
  `${LIB}/media/track/localaudiotrack`,
  `${LIB}/media/track/localvideotrack`
];

describe('restartWhenInadvertentlyStopped (VIDEO-14942)', () => {
  let LocalAudioTrack;
  let LocalVideoTrack;
  let silentAudio;
  let silentVideo;
  let savedDocument;

  function clearCache() {
    MODULES.forEach(m => delete require.cache[require.resolve(m)]);
  }

  before(() => {
    // A fresh document: tracks left over from earlier specs listen on the shared one and would
    // react to this spec's visibility events.
    savedDocument = global.document;
    global.document = new Document();
    clearCache();
    mock(`${LIB}/util/detectsilentaudio`, () => Promise.resolve(silentAudio));
    mock(`${LIB}/util/detectsilentvideo`, () => Promise.resolve(silentVideo));
    LocalAudioTrack = require(`${LIB}/media/track/localaudiotrack`);
    LocalVideoTrack = require(`${LIB}/media/track/localvideotrack`);
  });

  after(() => {
    mock.stopAll();
    clearCache();
    if (savedDocument) {
      global.document = savedDocument;
    } else {
      delete global.document;
    }
  });

  beforeEach(() => {
    document.visibilityState = 'visible';
    silentAudio = false;
    silentVideo = false;
  });

  // MediaStreamTrack#stop() does not fire "ended" in browsers; FakeMediaStreamTrack's does, which
  // would make every SDK-internal _stop() look like an inadvertent stop.
  function stopQuietly(mediaStreamTrack) {
    mediaStreamTrack.stop = function stop() { this.readyState = 'ended'; };
    return mediaStreamTrack;
  }

  function createTrack(LocalMediaTrack, kind, options = {}) {
    const getUserMedia = sinon.spy(constraints => fakeGetUserMedia(constraints).then(stream => {
      stream.getTracks().forEach(stopQuietly);
      return stream;
    }));
    const gUMSilentTrackWorkaround = sinon.spy((_log, gum, constraints) => gum(constraints));
    const track = new LocalMediaTrack(stopQuietly(new MediaStreamTrack(kind)), Object.assign({
      log,
      getUserMedia,
      gUMSilentTrackWorkaround,
      workaroundWebKitBug1208516: true
    }, options));
    sinon.spy(track, '_restart');
    return { track, getUserMedia, gUMSilentTrackWorkaround };
  }

  function unmute(track) {
    track.mediaStreamTrack.muted = true;
    track.mediaStreamTrack.setMuted(false);
  }

  // Simulates the OS ending the track (e.g. the capture device was taken away).
  function endInadvertently(track) {
    track.mediaStreamTrack.readyState = 'ended';
    track.mediaStreamTrack.dispatchEvent({ type: 'ended', target: track.mediaStreamTrack });
  }

  function setVisibility(state) {
    document.visibilityState = state;
    document.emit('visibilitychange', state);
  }

  describe('LocalAudioTrack', () => {
    let track;
    let gUMSilentTrackWorkaround;

    beforeEach(() => {
      ({ track, gUMSilentTrackWorkaround } = createTrack(LocalAudioTrack, 'audio'));
    });

    afterEach(() => {
      track.stop();
    });

    it('re-acquires a silent track with a single getUserMedia (no silent-track retries)', async () => {
      silentAudio = true;
      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledOnce(track._restart);
      sinon.assert.calledWith(track._restart, undefined, { silentTrackRetries: 0 });
      sinon.assert.calledOnce(gUMSilentTrackWorkaround);
      assert.strictEqual(gUMSilentTrackWorkaround.args[0][3], 0);
    });

    it('does not check silence on the first "unmute" of a track re-acquired for silence', async () => {
      silentAudio = true;
      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledOnce(track._restart);

      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledOnce(track._restart);
    });

    it('checks silence again on the second "unmute" of a track re-acquired for silence', async () => {
      silentAudio = true;
      unmute(track);
      await waitForSometime(100);
      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledOnce(track._restart);

      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledTwice(track._restart);
    });

    it('still re-acquires a silent track when the page becomes visible', async () => {
      silentAudio = true;
      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledOnce(track._restart);

      setVisibility('hidden');
      setVisibility('visible');
      await waitForSometime(100);
      sinon.assert.calledTwice(track._restart);
    });

    it('checks silence on "unmute" after the page was hidden', async () => {
      silentAudio = true;
      unmute(track);
      await waitForSometime(100);

      setVisibility('hidden');
      document.visibilityState = 'visible';
      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledTwice(track._restart);
    });

    it('re-acquires an ended track with the default silent-track retries', async () => {
      endInadvertently(track);
      await waitForSometime(100);
      sinon.assert.calledOnce(track._restart);
      sinon.assert.calledWith(track._restart, undefined, undefined);
      assert.strictEqual(gUMSilentTrackWorkaround.args[0][3], undefined);
    });

    it('does not skip the next "unmute" silence check after re-acquiring an ended track', async () => {
      endInadvertently(track);
      await waitForSometime(100);
      sinon.assert.calledOnce(track._restart);

      silentAudio = true;
      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledTwice(track._restart);
    });

    it('does not restart a muted microphone while the page is visible', async () => {
      track.mediaStreamTrack.setMuted(true);
      await waitForSometime(1300);
      sinon.assert.notCalled(track._restart);
    });

    it('does not re-acquire a non-silent track on "unmute"', async () => {
      unmute(track);
      await waitForSometime(100);
      sinon.assert.notCalled(track._restart);
    });
  });

  describe('LocalVideoTrack', () => {
    let track;

    afterEach(() => {
      track.stop();
    });

    it('restarts a silent camera once per "unmute" when both iOS workarounds are installed', async () => {
      ({ track } = createTrack(LocalVideoTrack, 'video', { workaroundSilentLocalVideo: true }));
      silentVideo = true;
      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledOnce(track._restart);
    });

    it('keeps silent-track retries for video re-acquires', async () => {
      let gUMSilentTrackWorkaround;
      ({ track, gUMSilentTrackWorkaround } = createTrack(LocalVideoTrack, 'video', { workaroundSilentLocalVideo: true }));
      silentVideo = true;
      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledWith(track._restart, undefined, undefined);
      assert.strictEqual(gUMSilentTrackWorkaround.args[0][3], undefined);
    });

    // sinon 4 has no clock.tickAsync(): fake the timers and Date, and let promises settle between ticks.
    async function withFakeClock(fn) {
      const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      const flush = () => new Promise(resolve => setImmediate(resolve));
      const tick = ms => Array.from({ length: Math.ceil(ms / 10) }).reduce(
        promise => promise.then(() => { clock.tick(10); return flush(); }),
        Promise.resolve());
      try {
        await fn(tick);
      } finally {
        clock.restore();
      }
    }

    // On iOS, acquiring the microphone while the camera is capturing mutes the camera.
    function acquireMicrophone() {
      createTrack(LocalAudioTrack, 'audio', { workaroundWebKitBug1208516: false }).track.stop();
    }

    it('restarts a camera still muted 1 s after a "mute" that followed a microphone acquisition', () => withFakeClock(async tick => {
      ({ track } = createTrack(LocalVideoTrack, 'video'));
      acquireMicrophone();
      track.mediaStreamTrack.setMuted(true);
      await tick(500);
      sinon.assert.notCalled(track._restart);
      await tick(800);
      sinon.assert.calledOnce(track._restart);
    }));

    it('does not restart a muted camera when no microphone was acquired in the previous 3 s (e.g. an incoming call)', () => withFakeClock(async tick => {
      ({ track } = createTrack(LocalVideoTrack, 'video'));
      acquireMicrophone();
      await tick(3100);
      track.mediaStreamTrack.setMuted(true);
      await tick(1300);
      sinon.assert.notCalled(track._restart);
    }));

    it('restarts the re-acquired camera on a later "mute" only if it followed a microphone acquisition', () => withFakeClock(async tick => {
      ({ track } = createTrack(LocalVideoTrack, 'video'));
      acquireMicrophone();
      track.mediaStreamTrack.setMuted(true);
      await tick(1300);
      sinon.assert.calledOnce(track._restart);

      // The re-acquired camera is muted again with no new microphone acquisition: no second restart.
      await tick(2000);
      track.mediaStreamTrack.setMuted(true);
      await tick(1300);
      sinon.assert.calledOnce(track._restart);

      // After an unmute, a mute that follows a microphone acquisition is handled again.
      track.mediaStreamTrack.setMuted(false);
      await tick(100);
      acquireMicrophone();
      track.mediaStreamTrack.setMuted(true);
      await tick(1300);
      sinon.assert.calledTwice(track._restart);
    }));

    it('does not restart a camera that is unmuted within 1 s', () => withFakeClock(async tick => {
      ({ track } = createTrack(LocalVideoTrack, 'video'));
      acquireMicrophone();
      track.mediaStreamTrack.setMuted(true);
      await tick(300);
      track.mediaStreamTrack.setMuted(false);
      await tick(1100);
      sinon.assert.notCalled(track._restart);
    }));

    it('does not restart a muted camera while the page is hidden', () => withFakeClock(async tick => {
      ({ track } = createTrack(LocalVideoTrack, 'video'));
      acquireMicrophone();
      track.mediaStreamTrack.setMuted(true);
      setVisibility('hidden');
      await tick(1300);
      sinon.assert.notCalled(track._restart);
    }));

    it('restarts a silent camera on "unmute" when only workaroundSilentLocalVideo is installed', async () => {
      ({ track } = createTrack(LocalVideoTrack, 'video', {
        workaroundSilentLocalVideo: true,
        workaroundWebKitBug1208516: false
      }));
      silentVideo = true;
      unmute(track);
      await waitForSometime(100);
      sinon.assert.calledOnce(track._restart);
    });
  });
});
