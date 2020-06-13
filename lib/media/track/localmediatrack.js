/* eslint new-cap:0 */
'use strict';

const MediaTrackSender = require('./sender');
const { getUserMedia } = require('@twilio/webrtc');
const { capitalize, waitForSometime, waitForEvent } = require('../../util');
const { typeErrors: { ILLEGAL_INVOKE } } = require('../../util/constants');

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
      // TODO(mmalavalli): Enable this workaround for Safari when ready. Here is
      // the boolean expression:
      // guessBrowser() === 'safari'
      //   && typeof document === 'object'
      //   && typeof document.addEventListener === 'function'
      //   && typeof document.visibilityState === 'string';
      const workaroundWebKitBug1208516 = false;

      options = Object.assign({
        getUserMedia,
        isCreatedByCreateLocalTracks: false,
        workaroundWebKitBug1208516
      }, options);

      const mediaTrackSender = new MediaTrackSender(mediaStreamTrack);
      super(mediaTrackSender, options);

      Object.defineProperties(this, {
        _getUserMedia: {
          value: options.getUserMedia
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

      // NOTE(mpatwardhan): As a workaround for WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=208516,
      // upon foregrounding, re-acquire new MediaStreamTrack if the existing one is ended or muted.
      if (options.workaroundWebKitBug1208516) {
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
        _log: log,
        mediaStreamTrack: { kind }
      } = this;

      log.info('Re-acquiring the MediaStreamTrack');
      log.debug('Constraints:', constraints);

      const gUMConstraints = Object.assign({
        audio: false,
        video: false
      }, { [kind]: constraints });

      return getUserMedia(gUMConstraints).then(mediaStream => {
        return mediaStream.getTracks()[0];
      });
    }

    /**
     * @private
     */
    _restart(constraints) {
      const { _log: log, mediaStreamTrack } = this;
      constraints = constraints || mediaStreamTrack.getConstraints();
      return this._reacquireTrack(constraints).catch(error => {
        log.error('Failed to re-acquire the MediaStreamTrack:', error, constraints);
        throw error;
      }).then(newMediaStreamTrack => {
        log.info('Re-acquired the MediaStreamTrack');
        log.debug('MediaStreamTrack:', newMediaStreamTrack);
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
      return this._restart(constraints);
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

function restartWhenInadvertentlyStopped(localMediaTrack) {
  let trackChangeInProgress = false;

  function shouldReacquireTrack() {
    const { _workaroundWebKitBug1208516Cleanup, isStopped, mediaStreamTrack: { muted } } = localMediaTrack;
    const isInadvertentlyStopped = isStopped && !!_workaroundWebKitBug1208516Cleanup;
    return document.visibilityState === 'visible' && (muted || isInadvertentlyStopped) && !trackChangeInProgress;
  }

  function handleTrackStateChange() {
    Promise.race([
      waitForEvent(localMediaTrack.mediaStreamTrack, 'unmute'),
      waitForSometime(50)
    ]).then(() => {
      if (shouldReacquireTrack()) {
        trackChangeInProgress = true;
        localMediaTrack._restart().finally(() => {
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
