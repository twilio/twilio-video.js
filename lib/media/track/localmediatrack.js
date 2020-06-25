'use strict';

const { getUserMedia } = require('@twilio/webrtc');
const { guessBrowser } = require('@twilio/webrtc/lib/util');

const { defer, waitForSometime, waitForEvent } = require('../../util');
const documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');
const gUMSilentTrackWorkaround = require('../../webaudio/workaround180748');
const MediaTrackSender = require('./sender');

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
      // NOTE(mpatwardhan): by default workaround for WebKitBug1208516 will be enabled on Safari browsers
      // although the bug is seen  mainly on iOS devices, we do not have a reliable way to tell iOS from MacOs
      // userAgent on iOS pretends its macOs if Safari is set to request desktop pages.
      const workaroundWebKitBug1208516 = guessBrowser() === 'safari'
        && typeof document === 'object'
        && typeof document.addEventListener === 'function'
        && typeof document.visibilityState === 'string';

      options = Object.assign({
        workaroundWebKitBug1208516,
        getUserMedia,
        gUMSilentTrackWorkaround
      }, options);

      const mediaTrackSender = new MediaTrackSender(mediaStreamTrack);
      super(mediaTrackSender, options);

      Object.defineProperties(this, {
        _getUserMedia: {
          value: options.getUserMedia,
        },
        _gUMSilentTrackWorkaround: {
          value: options.gUMSilentTrackWorkaround
        },
        _workaroundWebKitBug1208516Cleanup: {
          value: null,
          writable: true
        },
        _didCallEnd: {
          value: false,
          writable: true
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

      // NOTE(mpatwardhan): As a workaround for WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=208516,
      // upon foregrounding, re-acquire new MediaStreamTrack if the existing one is ended or muted.
      if (options.workaroundWebKitBug1208516) {
        this._workaroundWebKitBug1208516Cleanup = restartWhenInadvertentlyStopped(this);
      }
    }

    /**
     * @private
     * replaces underlying track and
     * returns a promise.
     */
    _setMediaStreamTrack(mediaStreamTrack) {
      // NOTE(mpatwardhan): Preserve the value of the "enabled" flag.
      mediaStreamTrack.enabled = this.mediaStreamTrack.enabled;

      return this._trackSender.setMediaStreamTrack(mediaStreamTrack).catch(err => {
        this._log.warn('setMediaStreamTrack failed:', err, mediaStreamTrack);
      }).then(() => {
        this._initialize();
        this._getAllAttachedElements().forEach(el => this._attach(el));
      });
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
    _end() {
      if (this._didCallEnd) {
        return;
      }
      super._end.call(this);
      this._didCallEnd = true;
      this.emit('stopped', this);
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

    stop() {
      this._log.info('Stopping');
      if (this._workaroundWebKitBug1208516Cleanup) {
        this._workaroundWebKitBug1208516Cleanup();
        this._workaroundWebKitBug1208516Cleanup = null;
      }
      this.mediaStreamTrack.stop();
      this._end();
      return this;
    }
  };
}

function restartWhenInadvertentlyStopped(localMediaTrack) {
  const { _getUserMedia: getUserMedia, _gUMSilentTrackWorkaround: gUMSilentTrackWorkaround, _log: log, kind } = localMediaTrack;
  let mediaStreamTrack = localMediaTrack.mediaStreamTrack;
  let trackChangeInProgress = null;

  function shouldReacquireTrack() {
    const { _workaroundWebKitBug1208516Cleanup, isStopped, mediaStreamTrack: { muted } } = localMediaTrack;
    const isInadvertentlyStopped = isStopped && !!_workaroundWebKitBug1208516Cleanup;
    return document.visibilityState === 'visible' && (muted || isInadvertentlyStopped) && !trackChangeInProgress;
  }

  function reacquireTrack() {
    const { mediaStreamTrack } = localMediaTrack;
    const constraints = Object.assign({
      audio: false,
      video: false
    }, { [kind]: mediaStreamTrack.getConstraints() });

    log.info('Re-acquiring the MediaStreamTrack.');
    log.debug('Constraints:', constraints);

    return gUMSilentTrackWorkaround(log, getUserMedia, constraints).then(mediaStream => {
      return mediaStream.getTracks()[0];
    }).catch(err => {
      log.warn(`Failed to re-acquire the ${kind} Track:`, err);
      throw err;
    });
  }

  function handleTrackStateChange() {
    return Promise.race([
      waitForEvent(mediaStreamTrack, 'unmute'),
      waitForSometime(50)
    ]).then(() => {
      if (shouldReacquireTrack()) {
        trackChangeInProgress = defer();
        return reacquireTrack().then(newTrack => {
          log.info('Re-acquired the MediaStreamTrack.');
          log.debug('MediaStreamTrack:', newTrack);
          return localMediaTrack._setMediaStreamTrack(newTrack);
        }).catch(err => {
          log.warn(`Error Updating ${kind} Track`, err);
        }).finally(() => {
          // reattach listener on updated mediaStream
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

module.exports = mixinLocalMediaTrack;
