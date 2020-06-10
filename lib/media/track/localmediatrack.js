'use strict';

const MediaTrackSender = require('./sender');
const { getUserMedia } = require('@twilio/webrtc');
const { guessBrowser } = require('@twilio/webrtc/lib/util');
const { waitForSometime, waitForEvent } = require('../../util');

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
        getUserMedia
      }, options);

      const mediaTrackSender = new MediaTrackSender(mediaStreamTrack);
      super(mediaTrackSender, options);

      Object.defineProperties(this, {
        _getUserMedia: {
          value: options.getUserMedia,
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
  const { _getUserMedia: getUserMedia, _log: log } = localMediaTrack;
  let trackChangeInProgress = false;

  function shouldReacquireTrack() {
    const { _workaroundWebKitBug1208516Cleanup, isStopped, mediaStreamTrack: { muted } } = localMediaTrack;
    const isInadvertentlyStopped = isStopped && !!_workaroundWebKitBug1208516Cleanup;
    return document.visibilityState === 'visible' && (muted || isInadvertentlyStopped) && !trackChangeInProgress;
  }

  function reacquireTrack() {
    const { kind, mediaStreamTrack } = localMediaTrack;
    const constraints = Object.assign({
      audio: false,
      video: false
    }, { [kind]: mediaStreamTrack.getConstraints() });

    log.info('Re-acquiring the MediaStreamTrack.');
    log.debug('Constraints:', constraints);
    return getUserMedia(constraints).then(mediaStream => {
      return mediaStream.getTracks()[0];
    });
  }

  function handleTrackStateChange() {
    Promise.race([
      waitForEvent(localMediaTrack.mediaStreamTrack, 'unmute'),
      waitForSometime(50)
    ]).then(() => {
      if (shouldReacquireTrack()) {
        trackChangeInProgress = true;
        reacquireTrack().then(newTrack => {
          log.info('Re-acquired the MediaStreamTrack.');
          log.debug('MediaStreamTrack:', newTrack);
          localMediaTrack._setMediaStreamTrack(newTrack);
        }).catch(err => {
          log.warn('Failed to re-acquire the MediaStreamTrack:', err);
        }).finally(() => {
          trackChangeInProgress = false;
        });
      }
    });
  }

  document.addEventListener('visibilitychange', handleTrackStateChange);
  localMediaTrack.on('stopped', handleTrackStateChange);
  return () => {
    document.removeEventListener('visibilitychange', handleTrackStateChange);
    localMediaTrack.removeListener('stopped', handleTrackStateChange);
  };
}

module.exports = mixinLocalMediaTrack;
