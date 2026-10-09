/* eslint new-cap:0 */
'use strict';

const { getUserMedia } = require('../../webrtc');
const { isIOS } = require('../../util/browserdetection');

const { capitalize, defer, waitForSometime, waitForEvent } = require('../../util');
const { typeErrors: { ILLEGAL_INVOKE } } = require('../../util/constants');
const detectSilentAudio = require('../../util/detectsilentaudio');
const detectSilentVideo = require('../../util/detectsilentvideo');
const documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');
const localMediaRestartDeferreds = require('../../util/localmediarestartdeferreds');
const gUMSilentTrackWorkaround = require('../../webaudio/workaround180748');
const Timeout = require('../../util/timeout');
const MediaTrackSender = require('./sender');

// NOTE(VIDEO-14942): Time of the most recent microphone acquisition (a new LocalAudioTrack that
// captures from a microphone, or an audio re-acquire). On iOS, acquiring the microphone while the camera
// is capturing mutes the camera. A LocalAudioTrack with no capture device (e.g. one the app made with
// WebAudio) does not count.
let lastAudioAcquisitionTime = -Infinity;
function noteAudioAcquisition() {
  lastAudioAcquisitionTime = Date.now();
}

// Tracks from createLocalTracks always count: with noise cancellation, the track may be a processed
// one that reports no capture device.
function isMicrophoneAcquisition(mediaStreamTrack, isCreatedByCreateLocalTracks) {
  return isCreatedByCreateLocalTracks
    || (typeof mediaStreamTrack.getSettings === 'function' && !!mediaStreamTrack.getSettings().deviceId);
}

function mixinLocalMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link LocalMediaTrack} represents audio or video that your
   * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
   * enabled and disabled with {@link LocalMediaTrack#enable} and
   * {@link LocalMediaTrack#disable} or stopped completely with
   * {@link LocalMediaTrack#stop}.
   * @emits LocalMediaTrack#muted
   * @emits LocalMediaTrack#stopped
   * @emits LocalMediaTrack#unmuted
   */
  return class LocalMediaTrack extends AudioOrVideoTrack {
    /**
     * Construct a {@link LocalMediaTrack} from a MediaStreamTrack.
     * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
     * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
     */
    constructor(mediaStreamTrack, options) {
      const workaroundWebKitBug1208516 = isIOS()
        && typeof document === 'object'
        && typeof document.addEventListener === 'function'
        && typeof document.visibilityState === 'string';

      options = Object.assign({
        getUserMedia,
        isCreatedByCreateLocalTracks: false,
        workaroundWebKitBug1208516,
        gUMSilentTrackWorkaround
      }, options);

      const mediaTrackSender = new MediaTrackSender(mediaStreamTrack);
      const { kind } = mediaTrackSender;

      super(mediaTrackSender, options);

      if (kind === 'audio' && isMicrophoneAcquisition(mediaStreamTrack, options.isCreatedByCreateLocalTracks)) {
        noteAudioAcquisition();
      }

      Object.defineProperties(this, {
        _constraints: {
          value: typeof options[kind] === 'object'
            ? options[kind]
            : {},
          writable: true
        },
        _getUserMedia: {
          value: options.getUserMedia
        },
        _gUMSilentTrackWorkaround: {
          value: options.gUMSilentTrackWorkaround
        },
        _eventsToReemitters: {
          value: new Map([
            ['muted', () => this.emit('muted', this)],
            ['unmuted', () => this.emit('unmuted', this)]
          ])
        },
        _workaroundWebKitBug1208516: {
          value: options.workaroundWebKitBug1208516
        },
        _workaroundWebKitBug1208516Cleanup: {
          value: null,
          writable: true
        },
        _didCallEnd: {
          value: false,
          writable: true
        },
        _isCreatedByCreateLocalTracks: {
          value: options.isCreatedByCreateLocalTracks
        },
        _noiseCancellation: {
          value: options.noiseCancellation || null
        },
        _trackSender: {
          value: mediaTrackSender
        },
        id: {
          enumerable: true,
          value: mediaTrackSender.id
        },
        isEnabled: {
          enumerable: true,
          get() {
            return mediaTrackSender.enabled;
          }
        },
        isMuted: {
          enumerable: true,
          get() {
            return mediaTrackSender.muted;
          }
        },
        isStopped: {
          enumerable: true,
          get() {
            return mediaTrackSender.readyState === 'ended';
          }
        }
      });

      // NOTE(mpatwardhan): As a workaround for WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=208516,
      // upon foregrounding, re-acquire new MediaStreamTrack if the existing one is ended or muted.
      if (this._workaroundWebKitBug1208516) {
        this._workaroundWebKitBug1208516Cleanup = restartWhenInadvertentlyStopped(this);
      }

      this._reemitTrackSenderEvents();
    }

    /**
     * @private
     */
    _end() {
      if (this._didCallEnd) {
        return;
      }
      super._end.call(this);
      this._didCallEnd = true;
      this._eventsToReemitters.forEach((reemitter, event) => this._trackSender.removeListener(event, reemitter));
      this.emit('stopped', this);
    }

    /**
     * @private
     */
    _initialize() {
      if (this._didCallEnd) {
        this._didCallEnd = false;
      }
      if (this._eventsToReemitters) {
        this._reemitTrackSenderEvents();
      }
      super._initialize.call(this);
    }

    /**
     * @private
     */
    _reacquireTrack(constraints, options) {
      const {
        _getUserMedia: getUserMedia,
        _gUMSilentTrackWorkaround: gUMSilentTrackWorkaround,
        _log: log,
        mediaStreamTrack: { kind }
      } = this;

      log.info('Re-acquiring the MediaStreamTrack');
      log.debug('Constraints:', constraints);

      const gUMConstraints = Object.assign({
        audio: false,
        video: false
      }, { [kind]: constraints });

      const retries = options && options.silentTrackRetries;
      if (kind === 'audio') {
        noteAudioAcquisition();
      }
      // With no retries, the silent-track workaround would only detect silence and log it.
      const gUMPromise = this._workaroundWebKitBug1208516Cleanup && retries !== 0
        ? gUMSilentTrackWorkaround(log, getUserMedia, gUMConstraints, retries)
        : getUserMedia(gUMConstraints);

      return gUMPromise.then(mediaStream => {
        if (kind === 'audio') {
          noteAudioAcquisition();
        }
        return mediaStream.getTracks()[0];
      });
    }

    /**
     * @private
     */
    _reemitTrackSenderEvents() {
      this._eventsToReemitters.forEach((reemitter, event) => this._trackSender.on(event, reemitter));
      this._trackSender.dequeue('muted');
      this._trackSender.dequeue('unmuted');
    }

    /**
     * @private
     */
    _restart(constraints, options) {
      const { _log: log } = this;
      constraints = constraints || this._constraints;

      // NOTE(mmalavalli): If we try and restart a silent MediaStreamTrack
      // without stopping it first, then a NotReadableError is raised in case of
      // video, or the restarted audio will still be silent. Hence, we stop the
      // MediaStreamTrack here.
      this._stop();

      return this._reacquireTrack(constraints, options).catch(error => {
        log.error('Failed to re-acquire the MediaStreamTrack:', { error, constraints });
        throw error;
      }).then(newMediaStreamTrack => {
        log.info('Re-acquired the MediaStreamTrack');
        log.debug('MediaStreamTrack:', newMediaStreamTrack);
        this._constraints = Object.assign({}, constraints);
        return this._setMediaStreamTrack(newMediaStreamTrack);
      });
    }

    /**
     * @private
     */
    _setMediaStreamTrack(mediaStreamTrack) {
      // NOTE(mpatwardhan): Preserve the value of the "enabled" flag.
      mediaStreamTrack.enabled = this.mediaStreamTrack.enabled;

      // NOTE(mmalavalli): Stop the current MediaStreamTrack. If not already
      // stopped, this should fire a "stopped" event.
      this._stop();

      // NOTE(csantos): If there's an unprocessedTrack, this means RTCRtpSender has
      // the processedTrack already set, we don't want to replace that.
      return (this._unprocessedTrack ? Promise.resolve().then(() => {
        this._unprocessedTrack = mediaStreamTrack;
      }) : this._trackSender.setMediaStreamTrack(mediaStreamTrack).catch(error => {
        this._log.warn('setMediaStreamTrack failed:', { error, mediaStreamTrack });
      })).then(() => {
        this._initialize();
        this._getAllAttachedElements().forEach(el => this._attach(el));
      });
    }

    /**
     * @private
     */
    _stop() {
      this.mediaStreamTrack.stop();
      this._end();
      return this;
    }

    enable(enabled) {
      enabled = typeof enabled === 'boolean' ? enabled : true;
      if (enabled !== this.mediaStreamTrack.enabled) {
        this._log.info(`${enabled ? 'En' : 'Dis'}abling`);
        this.mediaStreamTrack.enabled = enabled;
        this.emit(enabled ? 'enabled' : 'disabled', this);
      }
      return this;
    }

    disable() {
      return this.enable(false);
    }

    restart(constraints) {
      const { kind } = this;
      if (!this._isCreatedByCreateLocalTracks) {
        return Promise.reject(ILLEGAL_INVOKE('restart', 'can only be called on a'
          + ` Local${capitalize(kind)}Track that is created using createLocalTracks`
          + ` or createLocal${capitalize(kind)}Track.`));
      }
      if (this._workaroundWebKitBug1208516Cleanup) {
        this._workaroundWebKitBug1208516Cleanup();
        this._workaroundWebKitBug1208516Cleanup = null;
      }
      let promise = this._restart(constraints);

      if (this._workaroundWebKitBug1208516) {
        promise = promise.finally(() => {
          this._workaroundWebKitBug1208516Cleanup = restartWhenInadvertentlyStopped(this);
        });
      }
      return promise;
    }

    stop() {
      this._log.info('Stopping');
      if (this._workaroundWebKitBug1208516Cleanup) {
        this._workaroundWebKitBug1208516Cleanup();
        this._workaroundWebKitBug1208516Cleanup = null;
      }
      return this._stop();
    }
  };
}

/**
 * Restart the given {@link LocalMediaTrack} if it has been inadvertently stopped.
 * @private
 * @param {LocalAudioTrack|LocalVideoTrack} localMediaTrack
 * @returns {function} Clean up listeners attached by the workaround
 */
function restartWhenInadvertentlyStopped(localMediaTrack) {
  const {
    _log: log,
    kind,
    _noiseCancellation: noiseCancellation
  } = localMediaTrack;

  const detectSilence = {
    audio: detectSilentAudio,
    video: detectSilentVideo
  }[kind];

  const getSourceMediaStreamTrack = () => noiseCancellation
    ? noiseCancellation.sourceTrack
    : localMediaTrack.mediaStreamTrack;

  let { _dummyEl: el } = localMediaTrack;
  let mediaStreamTrack = getSourceMediaStreamTrack();
  let trackChangeInProgress = null;
  let mutedCameraRestartRetries = 0;
  // Set by the returned cleanup; a restart still in flight must not schedule anything afterwards.
  let disposed = false;

  // NOTE(VIDEO-14942): While another app (a phone or FaceTime call) holds the microphone, every
  // audio MediaStreamTrack iOS returns is silent. Re-acquiring does not help, and on iOS each audio
  // getUserMedia interrupts the camera, so a silence-driven retry loop makes the local video flicker.
  // Silence-driven audio re-acquires therefore get a single getUserMedia (no silent-track retries),
  // and the first "unmute" of the track they produce does not trigger another silence check.
  // Re-acquires for ended or muted tracks are unchanged.
  let skipSilenceCheckOnNextUnmute = false;
  const skipSilenceCheckTimeout = new Timeout(() => { skipSilenceCheckOnNextUnmute = false; }, 5000, false);
  function setSkipSilenceCheckOnNextUnmute(skip) {
    skipSilenceCheckOnNextUnmute = skip;
    if (skip) {
      skipSilenceCheckTimeout.reset();
    } else {
      skipSilenceCheckTimeout.clear();
    }
  }

  function checkSilence() {
    // The dummy element is paused, so play it and then detect silence.
    return el.play().then(() => detectSilence(el)).then(isSilent => {
      if (isSilent) {
        log.warn('Silence detected');
      } else {
        log.info('Non-silence detected');
      }
      return isSilent;
    }).catch(error => {
      log.warn('Failed to detect silence:', error);
    }).finally(() => {
      // Pause the dummy element again, if there is no processed track.
      if (!localMediaTrack.processedTrack) {
        el.pause();
      }
    });
  }

  // Resolves to null (no restart), 'stopped' (muted or inadvertently stopped) or 'silence'.
  function shouldReacquireTrack(trigger) {
    const {
      _workaroundWebKitBug1208516Cleanup,
      isStopped
    } = localMediaTrack;

    const isInadvertentlyStopped = isStopped && !!_workaroundWebKitBug1208516Cleanup;
    const { muted } = getSourceMediaStreamTrack();

    // NOTE(mmalavalli): Restart the LocalMediaTrack if:
    // 1. The app is foregrounded, and
    // 2. A restart is not already in progress, and
    // 3. The LocalMediaTrack is either muted, inadvertently stopped or silent
    return Promise.resolve().then(() => {
      if (document.visibilityState !== 'visible' || trackChangeInProgress) {
        return null;
      }
      if (muted || isInadvertentlyStopped) {
        return 'stopped';
      }
      if (kind === 'audio' && trigger === 'unmute' && skipSilenceCheckOnNextUnmute) {
        setSkipSilenceCheckOnNextUnmute(false);
        log.info('Skipping silence check on the first unmute of a track re-acquired for silence');
        return null;
      }
      return checkSilence().then(isSilent => (isSilent ? 'silence' : null));
    });
  }

  function maybeRestart(trigger) {
    return Promise.race([
      waitForEvent(mediaStreamTrack, 'unmute'),
      waitForSometime(50)
    ]).then(() => shouldReacquireTrack(trigger)).then(reason => {
      if (reason && !trackChangeInProgress) {
        trackChangeInProgress = defer();
        const forSilence = kind === 'audio' && reason === 'silence';
        localMediaTrack._restart(undefined, forSilence ? { silentTrackRetries: 0 } : undefined).finally(() => {
          el = localMediaTrack._dummyEl;
          removeMediaStreamTrackListeners();
          mediaStreamTrack = getSourceMediaStreamTrack();
          // After the cleanup ran (the app called stop() or restart()), this workaround must not
          // listen to the track again; restart() installs a new one.
          if (!disposed) {
            setSkipSilenceCheckOnNextUnmute(forSilence);
            addMediaStreamTrackListeners();
          }
          trackChangeInProgress.resolve();
          trackChangeInProgress = null;
        }).then(() => {
          mutedCameraRestartRetries = 0;
        }, error => {
          log.error('failed to restart track: ', error);
          if (trigger === 'mute') {
            scheduleMutedCameraRestartRetry();
          }
        });
      }

      // NOTE(mmalavalli): If the MediaStreamTrack ends before the DOM is visible,
      // then this makes sure that visibility callback for phase 2 is called only
      // after the MediaStreamTrack is re-acquired.
      const promise = (trackChangeInProgress && trackChangeInProgress.promise) || Promise.resolve();
      return promise.finally(() => localMediaRestartDeferreds.resolveDeferred(kind));
    }).catch(ex => {
      log.error(`error in maybeRestart: ${ex.message}`);
    });
  }

  // NOTE(VIDEO-14942): On iOS, acquiring the microphone while the camera is capturing mutes the
  // camera's MediaStreamTrack, and it stays muted for as long as that microphone track lives. With no
  // "unmute" or visibility change, nothing restarts the camera and the local video stays black.
  // So, a camera that is still muted 1 s after a "mute" that followed a microphone acquisition, while
  // the page is visible, is restarted. A "mute" with no recent microphone acquisition is an
  // interruption (e.g. an incoming call, or the camera being unavailable during iPad multitasking);
  // restarting the camera then does not help, and on iOS it disturbs the microphone.
  // The restart stops the muted camera before re-acquiring it, so if getUserMedia fails, the camera
  // is retried a few times with backoff instead of staying stopped until the page is hidden and shown.
  const MUTED_CAMERA_RESTART_DELAY_MS = 1000;
  const MUTED_CAMERA_AUDIO_ACQUISITION_WINDOW_MS = 3000;
  const MUTED_CAMERA_RESTART_RETRY_DELAYS_MS = [1000, 2000, 4000];
  let muteTime = -Infinity;
  const mutedCameraRestartTimeout = new Timeout(() => {
    const followsAudioAcquisition = lastAudioAcquisitionTime >= muteTime - MUTED_CAMERA_AUDIO_ACQUISITION_WINDOW_MS;
    if (followsAudioAcquisition && document.visibilityState === 'visible'
      && getSourceMediaStreamTrack().muted && !trackChangeInProgress) {
      log.info('Still muted while the page is visible; restarting the camera');
      maybeRestart('mute');
    }
  }, MUTED_CAMERA_RESTART_DELAY_MS, false);
  function scheduleMutedCameraRestart() {
    if (kind !== 'video') {
      return;
    }
    muteTime = Date.now();
    mutedCameraRestartTimeout.reset();
  }

  const mutedCameraRestartRetryTimeout = new Timeout(() => {
    if (document.visibilityState === 'visible' && !trackChangeInProgress) {
      log.info(`Retrying the camera restart (retry #${mutedCameraRestartRetries})`);
      maybeRestart('mute');
    }
  }, 0, false);
  function scheduleMutedCameraRestartRetry() {
    if (disposed) {
      return;
    }
    if (mutedCameraRestartRetries >= MUTED_CAMERA_RESTART_RETRY_DELAYS_MS.length) {
      log.warn('Failed to restart the camera; it will be restarted when the page is shown again');
      return;
    }
    mutedCameraRestartRetryTimeout.setDelay(MUTED_CAMERA_RESTART_RETRY_DELAYS_MS[mutedCameraRestartRetries++]);
    mutedCameraRestartRetryTimeout.reset();
  }
  function cancelMutedCameraRestart() {
    mutedCameraRestartTimeout.clear();
    mutedCameraRestartRetryTimeout.clear();
    mutedCameraRestartRetries = 0;
  }

  function onMute() {
    const { _log: log, kind } = localMediaTrack;
    log.info('Muted');
    log.debug('LocalMediaTrack:', localMediaTrack);
    scheduleMutedCameraRestart();

    // NOTE(mmalavalli): When a LocalMediaTrack is muted without the app being
    // backgrounded, and the inadvertently paused elements are played before it
    // is restarted, it never gets unmuted due to the WebKit Bug 213853. Hence,
    // setting this Deferred will make sure that the inadvertently paused elements
    // are played only after the LocalMediaTrack is unmuted.
    //
    // Bug: https://bugs.webkit.org/show_bug.cgi?id=213853
    //
    localMediaRestartDeferreds.startDeferred(kind);
  }

  const onEnded = () => maybeRestart('ended');
  const onUnmute = () => {
    cancelMutedCameraRestart();
    return maybeRestart('unmute');
  };

  function addMediaStreamTrackListeners() {
    if (mediaStreamTrack.addEventListener) {
      mediaStreamTrack.addEventListener('ended', onEnded);
      mediaStreamTrack.addEventListener('mute', onMute);
      mediaStreamTrack.addEventListener('unmute', onUnmute);
    } else {
      mediaStreamTrack.onended = onEnded;
      mediaStreamTrack.onmute = onMute;
      mediaStreamTrack.onunmute = onUnmute;
    }
  }

  function removeMediaStreamTrackListeners() {
    if (mediaStreamTrack.removeEventListener) {
      mediaStreamTrack.removeEventListener('ended', onEnded);
      mediaStreamTrack.removeEventListener('mute', onMute);
      mediaStreamTrack.removeEventListener('unmute', onUnmute);
    } else {
      mediaStreamTrack.onended = null;
      mediaStreamTrack.onmute = null;
      mediaStreamTrack.onunmute = null;
    }
  }

  // NOTE(mpatwardhan): listen for document visibility callback on phase 1.
  // this ensures that we acquire media tracks before RemoteMediaTrack
  // tries to `play` them (in phase 2). This order is important because
  // play can fail on safari if audio is not being captured.
  let onVisibilityChange = isVisible => {
    cancelMutedCameraRestart();
    if (!isVisible) {
      setSkipSilenceCheckOnNextUnmute(false);
      return false;
    }
    return maybeRestart('visible');
  };
  documentVisibilityMonitor.onVisibilityChange(1, onVisibilityChange);
  addMediaStreamTrackListeners();

  return () => {
    disposed = true;
    skipSilenceCheckTimeout.clear();
    cancelMutedCameraRestart();
    documentVisibilityMonitor.offVisibilityChange(1, onVisibilityChange);
    removeMediaStreamTrackListeners();
  };
}

module.exports = mixinLocalMediaTrack;
