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

  function quietGetUserMedia(constraints) {
    return fakeGetUserMedia(constraints).then(stream => {
      stream.getTracks().forEach(stopQuietly);
      return stream;
    });
  }

  function createTrack(LocalMediaTrack, kind, options = {}) {
    const getUserMedia = sinon.spy(options.getUserMedia || quietGetUserMedia);
    const gUMSilentTrackWorkaround = sinon.spy((_log, gum, constraints) => gum(constraints));
    const track = new LocalMediaTrack(stopQuietly(new MediaStreamTrack(kind)), Object.assign({
      log,
      gUMSilentTrackWorkaround,
      workaroundWebKitBug1208516: true
    }, options, { getUserMedia }));
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
    let getUserMedia;
    let gUMSilentTrackWorkaround;

    beforeEach(() => {
      ({ track, getUserMedia, gUMSilentTrackWorkaround } = createTrack(LocalAudioTrack, 'audio'));
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
      sinon.assert.calledOnce(getUserMedia);
      sinon.assert.notCalled(gUMSilentTrackWorkaround);
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
    // The time of the last microphone acquisition is shared by all tracks, so each fake clock starts
    // well after any earlier acquisition (at real time, or on a previous fake clock); otherwise it
    // would look recent.
    let fakeNow = 0;
    async function withFakeClock(fn) {
      const now = Math.max(fakeNow, Date.now() + 10000);
      const clock = sinon.useFakeTimers({ now, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      const flush = () => new Promise(resolve => setImmediate(resolve));
      const tick = ms => Array.from({ length: Math.ceil(ms / 10) }).reduce(
        promise => promise.then(() => { clock.tick(10); return flush(); }),
        Promise.resolve());
      try {
        await fn(tick);
      } finally {
        fakeNow = Date.now() + 10000;
        clock.restore();
      }
    }

    // On iOS, acquiring the microphone while the camera is capturing mutes the camera.
    function acquireMicrophone() {
      createTrack(LocalAudioTrack, 'audio', {
        isCreatedByCreateLocalTracks: true,
        workaroundWebKitBug1208516: false
      }).track.stop();
    }

    // Rejects the first `failures` calls, as getUserMedia does when the camera is unavailable.
    function getUserMediaFailing(failures) {
      let calls = 0;
      return constraints => ++calls <= failures
        ? Promise.reject(new Error('NotReadableError'))
        : quietGetUserMedia(constraints);
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

    // A WebAudio destination track has no capture device, so its settings have no deviceId.
    function createNonCaptureAudioTrack() {
      const mediaStreamTrack = stopQuietly(new MediaStreamTrack('audio'));
      mediaStreamTrack.getSettings = () => ({});
      return new LocalAudioTrack(mediaStreamTrack, { log, workaroundWebKitBug1208516: false });
    }

    it('does not count a LocalAudioTrack with no capture device (e.g. WebAudio) as a microphone acquisition', () => withFakeClock(async tick => {
      ({ track } = createTrack(LocalVideoTrack, 'video'));
      createNonCaptureAudioTrack().stop();
      track.mediaStreamTrack.setMuted(true);
      await tick(1300);
      sinon.assert.notCalled(track._restart);
    }));

    it('counts a LocalAudioTrack the app created from its own microphone MediaStreamTrack as a microphone acquisition', () => withFakeClock(async tick => {
      ({ track } = createTrack(LocalVideoTrack, 'video'));
      new LocalAudioTrack(stopQuietly(new MediaStreamTrack('audio')), { log, workaroundWebKitBug1208516: false }).stop();
      track.mediaStreamTrack.setMuted(true);
      await tick(1300);
      sinon.assert.calledOnce(track._restart);
    }));

    it('does not restart again a camera that comes back muted from a restart on page visible', () => withFakeClock(async tick => {
      ({ track } = createTrack(LocalVideoTrack, 'video', {
        // A call holds the camera: every re-acquired camera track starts muted.
        getUserMedia: constraints => quietGetUserMedia(constraints).then(stream => {
          stream.getTracks()[0].muted = true;
          return stream;
        })
      }));
      track.mediaStreamTrack.muted = true;
      setVisibility('hidden');
      // The audio track is re-acquired on the same visibility change.
      acquireMicrophone();
      setVisibility('visible');
      await tick(300);
      sinon.assert.calledOnce(track._restart);

      await tick(2000);
      sinon.assert.calledOnce(track._restart);
    }));

    it('does not listen to the re-acquired camera when the track was stopped during the restart', () => withFakeClock(async tick => {
      let resolveGetUserMedia;
      ({ track } = createTrack(LocalVideoTrack, 'video', {
        getUserMedia: constraints => new Promise(resolve => { resolveGetUserMedia = () => resolve(quietGetUserMedia(constraints)); })
      }));
      acquireMicrophone();
      track.mediaStreamTrack.setMuted(true);
      await tick(1300);
      sinon.assert.calledOnce(track._restart);

      track.stop();
      resolveGetUserMedia();
      await tick(100);
      silentVideo = true;
      unmute(track);
      await tick(300);
      sinon.assert.calledOnce(track._restart);
    }));

    it('does not retry a failed muted-camera restart after the track is stopped', () => withFakeClock(async tick => {
      let rejectGetUserMedia;
      ({ track } = createTrack(LocalVideoTrack, 'video', {
        getUserMedia: () => new Promise((resolve, reject) => { rejectGetUserMedia = reject; })
      }));
      acquireMicrophone();
      track.mediaStreamTrack.setMuted(true);
      await tick(1300);
      sinon.assert.calledOnce(track._restart);

      track.stop();
      rejectGetUserMedia(new Error('NotReadableError'));
      await tick(10000);
      sinon.assert.calledOnce(track._restart);
    }));

    it('retries a muted-camera restart whose getUserMedia fails, so the camera does not stay stopped', () => withFakeClock(async tick => {
      ({ track } = createTrack(LocalVideoTrack, 'video', { getUserMedia: getUserMediaFailing(2) }));
      acquireMicrophone();
      track.mediaStreamTrack.setMuted(true);
      await tick(1300);
      assert.strictEqual(track.isStopped, true);

      await tick(1000 + 2000 + 500);
      sinon.assert.calledThrice(track._restart);
      assert.strictEqual(track.isStopped, false);
    }));

    it('stops retrying a muted-camera restart after 3 failed retries', () => withFakeClock(async tick => {
      ({ track } = createTrack(LocalVideoTrack, 'video', { getUserMedia: getUserMediaFailing(Infinity) }));
      acquireMicrophone();
      track.mediaStreamTrack.setMuted(true);
      await tick(1300 + 1000 + 2000 + 4000 + 10000);
      assert.strictEqual(track._restart.callCount, 4);
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
