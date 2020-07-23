/* eslint new-cap:0 */
'use strict';

const { getUserMedia } = require('@twilio/webrtc');
const { guessBrowser } = require('@twilio/webrtc/lib/util');

const { capitalize, defer, waitForSometime, waitForEvent } = require('../../util');
const { typeErrors: { ILLEGAL_INVOKE } } = require('../../util/constants');
const detectSilentAudio = require('../../util/detectsilentaudio');
const detectSilentVideo = require('../../util/detectsilentvideo');
const documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');
const gUMSilentTrackWorkaround = require('../../webaudio/workaround180748');
const MediaTrackSender = require('./sender');

const isSafari = guessBrowser() === 'safari';

function mixinLocalMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link LocalMediaTrack} represents audio or video that your
   * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
   * enabled and disabled with {@link LocalMediaTrack#enable} and
   * {@link LocalMediaTrack#disable} or stopped completely with
   * {@link LocalMediaTrack#stop}.
   * @emits LocalMediaTrack#stopped
   */
  return class LocalMediaTrack extends AudioOrVideoTrack {
    /**
     * Construct a {@link LocalMediaTrack} from a MediaStreamTrack.
     * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
     * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
     */
    constructor(mediaStreamTrack, options) {
      // NOTE(mmalavalli): By default, this workaround will be enabled on Safari browsers
      // although the bug is seen mainly on iOS devices, we do not have a reliable way to
      // tell iOS from MacOs userAgent on iOS pretends its macOs if Safari is set to request
      // desktop pages.
      const workaroundSilenceOnUnmute = isSafari
        && typeof document === 'object'
        && typeof document.createElement === 'function';

      // NOTE(mpatwardhan): by default workaround for WebKitBug1208516 will be enabled on Safari browsers
      // although the bug is seen  mainly on iOS devices, we do not have a reliable way to tell iOS from MacOs
      // userAgent on iOS pretends its macOs if Safari is set to request desktop pages.
      const workaroundWebKitBug1208516 = isSafari
        && typeof document === 'object'
        && typeof document.addEventListener === 'function'
        && typeof document.visibilityState === 'string';

      options = Object.assign({
        getUserMedia,
        isCreatedByCreateLocalTracks: false,
        workaroundSilenceOnUnmute,
        workaroundWebKitBug1208516,
        gUMSilentTrackWorkaround
      }, options);

      const mediaTrackSender = new MediaTrackSender(mediaStreamTrack);
      const { kind } = mediaTrackSender;

      super(mediaTrackSender, options);

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
        _workaroundSilenceOnUnmute: {
          value: options.workaroundSilenceOnUnmute
        },
        _workaroundWebKitBug1208516: {
          value: options.workaroundWebKitBug1208516
        },
        _workaroundSilenceOnUnmuteCleanup: {
          value: null,
          writable: true
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
        isStopped: {
          enumerable: true,
          get() {
            return mediaTrackSender.readyState === 'ended';
          }
        }
      });

      // NOTE(mmalavalli): In iOS Safari, we work around a bug where sometimes,
      // local MediaStreamTracks are silent after they are unmuted.
      if (this._workaroundSilenceOnUnmute) {
        this._workaroundSilenceOnUnmuteCleanup = restartWhenSilentOnUnmute(this);
      }

      // NOTE(mpatwardhan): As a workaround for WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=208516,
      // upon foregrounding, re-acquire new MediaStreamTrack if the existing one is ended or muted.
      if (this._workaroundWebKitBug1208516) {
        this._workaroundWebKitBug1208516Cleanup = restartWhenInadvertentlyStopped(this);
      }
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
      this.emit('stopped', this);
    }

    /**
     * @private
     */
    _initialize() {
      if (this._didCallEnd) {
        this._didCallEnd = false;
      }
      super._initialize.call(this);
    }

    /**
     * @private
     */
    _reacquireTrack(constraints) {
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

      const gUMPromise = this._workaroundWebKitBug1208516Cleanup
        ? gUMSilentTrackWorkaround(log, getUserMedia, gUMConstraints)
        : getUserMedia(gUMConstraints);

      return gUMPromise.then(mediaStream => {
        return mediaStream.getTracks()[0];
      });
    }

    /**
     * @private
     */
    _restart(constraints) {
      const { _log: log } = this;
      constraints = constraints || this._constraints;
      return this._reacquireTrack(constraints).catch(error => {
        log.error('Failed to re-acquire the MediaStreamTrack:', error, constraints);
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

      return this._trackSender.setMediaStreamTrack(mediaStreamTrack).catch(error => {
        this._log.warn('setMediaStreamTrack failed:', error, mediaStreamTrack);
      }).then(() => {
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

      if (this._workaroundSilenceOnUnmuteCleanup) {
        this._workaroundSilenceOnUnmuteCleanup();
        this._workaroundSilenceOnUnmuteCleanup = null;
      }
      if (this._workaroundWebKitBug1208516Cleanup) {
        this._workaroundWebKitBug1208516Cleanup();
        this._workaroundWebKitBug1208516Cleanup = null;
      }
      const promise = this._restart(constraints);

      if (this._workaroundSilenceOnUnmute) {
        promise.finally(() => {
          this._workaroundWebKitBug1208516Cleanup = restartWhenSilentOnUnmute(this);
        });
      }
      if (this._workaroundWebKitBug1208516) {
        promise.finally(() => {
          this._workaroundWebKitBug1208516Cleanup = restartWhenInadvertentlyStopped(this);
        });
      }

      return promise;
    }

    stop() {
      this._log.info('Stopping');
      if (this._workaroundSilenceOnUnmuteCleanup) {
        this._workaroundSilenceOnUnmuteCleanup();
        this._workaroundSilenceOnUnmuteCleanup = null;
      }
      if (this._workaroundWebKitBug1208516Cleanup) {
        this._workaroundWebKitBug1208516Cleanup();
        this._workaroundWebKitBug1208516Cleanup = null;
      }
      return this._stop();
    }
  };
}

function restartWhenInadvertentlyStopped(localMediaTrack) {
  let { mediaStreamTrack } = localMediaTrack;
  let trackChangeInProgress = null;

  function shouldReacquireTrack() {
    const { _workaroundWebKitBug1208516Cleanup, isStopped, mediaStreamTrack: { muted } } = localMediaTrack;
    const isInadvertentlyStopped = isStopped && !!_workaroundWebKitBug1208516Cleanup;
    return document.visibilityState === 'visible' && (muted || isInadvertentlyStopped) && !trackChangeInProgress;
  }

  function handleTrackStateChange() {
    return Promise.race([
      waitForEvent(mediaStreamTrack, 'unmute'),
      waitForSometime(50)
    ]).then(() => {
      if (shouldReacquireTrack()) {
        trackChangeInProgress = defer();
        localMediaTrack._restart().finally(() => {
          mediaStreamTrack.removeEventListener('ended', handleTrackStateChange);
          mediaStreamTrack = localMediaTrack.mediaStreamTrack;
          mediaStreamTrack.addEventListener('ended', handleTrackStateChange);
          trackChangeInProgress.resolve();
          trackChangeInProgress = null;
        });
      }

      // NOTE(mmalavalli): If the MediaStreamTrack ends before the DOM is visible,
      // then this makes sure that visibility callback for phase 2 is called only
      // after the MediaStreamTrack is re-acquired.
      return trackChangeInProgress && trackChangeInProgress.promise;
    });
  }

  // NOTE(mpatwardhan): listen for document visibility callback on phase 1.
  // this ensures that any we acquire media tracks before RemoteMediaTrack
  // tries to `play` them (in phase 2). This order is important because
  // play can fail on safari if audio is not being captured.
  documentVisibilityMonitor.onVisible(1, handleTrackStateChange);
  mediaStreamTrack.addEventListener('ended', handleTrackStateChange);
  return () => {
    documentVisibilityMonitor.offVisible(1, handleTrackStateChange);
    mediaStreamTrack.removeEventListener('ended', handleTrackStateChange);
  };
}

/**
 * Restart a {@link LocalMediaTrack} that is silent upon unmute.
 * @private
 * @param {LocalAudioTrack|LocalVideoTrack} localMediaTrack
 * @returns {function} Cleans up listeners attached by the workaround
 */
function restartWhenSilentOnUnmute(localMediaTrack) {
  const { _log: log, kind } = localMediaTrack;

  const detectSilence = {
    audio: detectSilentAudio,
    video: detectSilentVideo
  }[kind];

  let { _dummyEl: el, mediaStreamTrack } = localMediaTrack;

  function onUnmute() {
    if (!localMediaTrack.isEnabled) {
      return;
    }
    log.info('Unmuted, checking silence');

    // The dummy element is paused, so play it and then detect silence.
    el.play().then(() => detectSilence(el)).then(isSilent => {
      if (!isSilent) {
        log.info('Non-silence detected, no need to restart');
        return;
      }
      log.warn('Silence detected, restarting');

      // NOTE(mmalavalli): If we try and restart a silent MediaStreamTrack
      // without stopping it first, then a NotReadableError is raised in case of
      // video, or the restarted audio will still be silent. Hence, we stop the
      // MediaStreamTrack here.
      localMediaTrack._stop();

      // Restart the LocalMediaTrack.
      return localMediaTrack._restart();
    }).catch(error => {
      log.warn('Failed to detect silence and restart:', error);
    }).finally(() => {
      // If silence was not detected, then pause the dummy element again.
      el = localMediaTrack._dummyEl;
      if (!el.paused) {
        el.pause();
      }

      // Reset the unmute handler.
      mediaStreamTrack.removeEventListener('unmute', onUnmute);
      mediaStreamTrack = localMediaTrack.mediaStreamTrack;
      mediaStreamTrack.addEventListener('unmute', onUnmute);
    });
  }

  // Set the unmute handler.
  mediaStreamTrack.addEventListener('unmute', onUnmute);

  return () => {
    mediaStreamTrack.removeEventListener('unmute', onUnmute);
  };
}

module.exports = mixinLocalMediaTrack;
