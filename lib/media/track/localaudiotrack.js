'use strict';

const AudioTrack = require('./audiotrack');
const mixinLocalMediaTrack = require('./localmediatrack');

const LocalMediaAudioTrack = mixinLocalMediaTrack(AudioTrack);

const { getUserMedia } = require('@twilio/webrtc');
const { guessBrowser } = require('@twilio/webrtc/lib/util');
const { waitForSometime, waitForEvent } = require('../../util');

/**
 * A {@link LocalAudioTrack} is an {@link AudioTrack} representing audio that
 * your {@link LocalParticipant} can publish to a {@link Room}. It can be
 * enabled and disabled with {@link LocalAudioTrack#enable} and
 * {@link LocalAudioTrack#disable} or stopped completely with
 * {@link LocalAudioTrack#stop}.
 * @extends AudioTrack
 * @property {Track.ID} id - The {@link LocalAudioTrack}'s ID
 * @property {boolean} isStopped - Whether or not the {@link LocalAudioTrack} is
 *   stopped
 * @emits LocalAudioTrack#disabled
 * @emits LocalAudioTrack#enabled
 * @emits LocalAudioTrack#started
 * @emits LocalAudioTrack#stopped
 */

class LocalAudioTrack extends LocalMediaAudioTrack {
  /**
   * Construct a {@link LocalAudioTrack} from a MediaStreamTrack.
   * @param {MediaStreamTrack} mediaStreamTrack - An audio MediaStreamTrack
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

    super(mediaStreamTrack, options);
    Object.defineProperties(this, {
      _getUserMedia: {
        value: options.getUserMedia,
      },
      _didCallStop: {
        value: false,
        writable: true
      }
    });

    // NOTE(mpatwardhan): As a workaround for WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=208516,
    // upon foregrounding, re-acquire a new audio MediaStreamTrack if the existing one is ended or muted.
    if (options.workaroundWebKitBug1208516) {
      restartWhenInadvertentlyStopped(this);
    }
  }

  toString() {
    return `[LocalAudioTrack #${this._instanceId}: ${this.id}]`;
  }

  attach(el) {
    el = super.attach.call(this, el);
    el.muted = true;
    return el;
  }

  /**
   * @private
   */
  _end() {
    return super._end.apply(this, arguments);
  }

  /**
   * Disable the {@link LocalAudioTrack}. This is effectively "mute".
   * @returns {this}
   * @fires LocalAudioTrack#disabled
   */
  disable() {
    return super.disable.apply(this, arguments);
  }

  /**
   * Enable the {@link LocalAudioTrack}. This is effectively "unmute".
   * @returns {this}
   * @fires LocalAudioTrack#enabled
  *//**
   * Enable or disable the {@link LocalAudioTrack}. This is effectively "unmute"
   * or "mute".
   * @param {boolean} [enabled] - Specify false to mute the
   *   {@link LocalAudioTrack}
   * @returns {this}
   * @fires LocalAudioTrack#disabled
   * @fires LocalAudioTrack#enabled
   */
  enable() {
    return super.enable.apply(this, arguments);
  }

  /**
   * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
   * {@link LocalAudioTrack}, you should unpublish it after stopping.
   * @returns {this}
   * @fires LocalAudioTrack#stopped
   */
  stop() {
    this._didCallStop = true;
    return super.stop.apply(this, arguments);
  }
}

function restartWhenInadvertentlyStopped(localAudioTrack) {
  const { _getUserMedia: getUserMedia, _log: log } = localAudioTrack;

  function shouldReacquireTrack() {
    return document.visibilityState === 'visible'
      && (localAudioTrack.mediaStreamTrack.muted || localAudioTrack.isStopped)
      && !localAudioTrack._didCallStop;
  }

  function reacquireTrack(constraints) {
    return getUserMedia({ audio: constraints, video: false }).then(mediaStream => {
      return mediaStream.getAudioTracks()[0];
    });
  }

  function handleTrackStateChange() {
    Promise.race([
      waitForEvent(localAudioTrack.mediaStreamTrack, 'unmute'),
      waitForSometime(50)
    ]).then(() => {
      if (!shouldReacquireTrack()) {
        return;
      }
      const constraints = localAudioTrack.mediaStreamTrack.getConstraints();
      log.info('Re-acquiring the MediaStreamTrack.');
      log.debug('Constraints:', constraints);
      reacquireTrack(constraints).then(newTrack => {
        log.info('Re-acquired the MediaStreamTrack.');
        log.debug('MediaStreamTrack:', newTrack);
        localAudioTrack._setMediaStreamTrack(newTrack);
      }).catch(err => {
        log.warn('Failed to re-acquire the MediaStreamTrack:', err);
      });
    });
  }

  document.addEventListener('visibilitychange', handleTrackStateChange);
  localAudioTrack.on('stopped', handleTrackStateChange);
}


/**
 * The {@link LocalAudioTrack} was disabled, i.e. "muted".
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that was
 *   disabled
 * @event LocalAudioTrack#disabled
 */

/**
 * The {@link LocalAudioTrack} was enabled, i.e. "unmuted".
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that was enabled
 * @event LocalAudioTrack#enabled
 */

/**
 * The {@link LocalAudioTrack} started. This means there is enough audio data to
 * begin playback.
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that started
 * @event LocalAudioTrack#started
 */

/**
 * The {@link LocalAudioTrack} stopped, either because
 * {@link LocalAudioTrack#stop} was called or because the underlying
 * MediaStreamTrack ended).
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that stopped
 * @event LocalAudioTrack#stopped
 */

module.exports = LocalAudioTrack;
