'use strict';

const AudioTrack = require('./audiotrack');
const mixinLocalMediaTrack = require('./localmediatrack');

const LocalMediaAudioTrack = mixinLocalMediaTrack(AudioTrack);

const { getUserMedia } = require('@twilio/webrtc');
const { guessBrowser } = require('@twilio/webrtc/lib/util');

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
    const workaroundWebKitBug1208516 = guessBrowser() === 'safari';

    options = Object.assign({
      workaroundWebKitBug1208516,
      getUserMedia
    }, options);

    super(mediaStreamTrack, options);
    Object.defineProperties(this, {
      _watchCleanup: {
        value: null,
        writable: true
      },
      _getUserMedia: {
        value: options.getUserMedia,
      },
      _didCallStop: {
        value: false,
        writable: true
      }
    });

    // NOTE(mpatwardhan): as a workaround for webkitbug208516(https://bugs.webkit.org/show_bug.cgi?id=208516)
    // start watching document visibility and reacquire audio track if ended or muted.
    if (options.workaroundWebKitBug1208516) {
      this._startWatching(mediaStreamTrack);
    }
  }

  _shouldAttemptRestart() {
    const isDocumentVisible = document && document.visibilityState === 'visible';
    return isDocumentVisible && (this.mediaStreamTrack.muted || this.mediaStreamTrack.readyState === 'ended');
  }

  _acquireTrack() {
    const mediaStreamPromise = this._getUserMedia({ audio: true, video: false });
    return mediaStreamPromise.then(mediaStream => {
      return mediaStream.getAudioTracks()[0];
    });
  }

  _handleTrackStateChange() {
    if (this._shouldAttemptRestart()) {
      // give it a moment before re-acquiring.
      setTimeout(() => {
        this._log.debug('checking if audio track needs to be replaced');
        if (this._shouldAttemptRestart()) {
          // replace tracks.
          this._acquireTrack().then(newTrack => {
            this._log.debug('replacing track, ', newTrack.id);
            this._replaceTrack(newTrack).then(() => {
              // if the track was not manually stopped,
              if (!this._didCallStop) {
                // start watching new track
                this._startWatching(newTrack);
              }
            });
          }).catch(err => {
            this._log.debug('Failed to acquire track', err);
          });
        }
      }, 10);
    }
  }

  _startWatching(track) {
    // eslint-disable-next-line no-undefined
    if (!document || !document.addEventListener || document.visibilityState === undefined) {
      return;
    }

    // clear up previous watch.
    if (this._watchCleanup) {
      this._watchCleanup();
      this._watchCleanup = null;
    }

    // start new watch.
    if (track) {
      const stateChangedCallback = () => this._handleTrackStateChange();

      // we want to re-acquire track if document becomes visible
      // but the track has ended while page was background.
      document.addEventListener('visibilitychange', stateChangedCallback);

      // however on iOS when you quickly activate siri - while safari on foreground
      // the page does not receive visibilitychange, but the audio track goes into ended state anways.
      // to catch such cases lets listen on ended event as well.
      this._log.debug('watching track', track.id);
      track.addEventListener('ended', stateChangedCallback);

      // create a function to clean up this watch.
      this._watchCleanup = () => {
        this._log.debug('cleaning up watch for track:', track.id);
        track.removeEventListener('ended', stateChangedCallback);
        document.removeEventListener('visibilitychange', stateChangedCallback);
      };
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
    // track was stopped, stop watching, and don't start watching again.
    this._didCallStop = true;
    this._startWatching(null);
    return super.stop.apply(this, arguments);
  }
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
