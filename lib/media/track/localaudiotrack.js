'use strict';

const AudioTrack = require('./audiotrack');
const mixinLocalMediaTrack = require('./localmediatrack');

const LocalMediaAudioTrack = mixinLocalMediaTrack(AudioTrack);

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

const trackReAcquire = () => {
  const mediaStreamPromise = navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  return mediaStreamPromise.then(mediaStream => {
    return mediaStream.getAudioTracks()[0];
  });
};

class LocalAudioTrack extends LocalMediaAudioTrack {
  /**
   * Construct a {@link LocalAudioTrack} from a MediaStreamTrack.
   * @param {MediaStreamTrack} mediaStreamTrack - An audio MediaStreamTrack
   * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
   */
  constructor(mediaStreamTrack, options) {
    // eslint-disable-next-line no-console
    console.log('makarand LocalAudioTrack');
    const workaroundWebKitBug1208516 = true;
    super(mediaStreamTrack, options);
    Object.defineProperties(this, {
      _stateChangedCallback: {
        value: null,
        writable: true
      },
      workaroundWebKitBug1208516: {
        value: workaroundWebKitBug1208516,
      }
    });

    // start watching the track to ensure its active.
    // workaround for webkitbug208516
    // https://bugs.webkit.org/show_bug.cgi?id=208516
    if (workaroundWebKitBug1208516) {
      this._startWatching(true);
    }
  }

  log(...args) {
    // eslint-disable-next-line no-console
    console.log(`Makarand[${this._instanceId}]: MediaTrackTransceiver: `, ...args);
  }

  _shouldAttemptRestart() {
    // TODO: check if track was disabled and if not check for audio bytes.
    const isDocumentVisible = document && document.hidden === false;
    return isDocumentVisible && (this.mediaStreamTrack.muted || this.mediaStreamTrack.readyState === 'ended');
  }

  _handleTrackStateChange() {
    if (this._shouldAttemptRestart()) {
      // give it a second for things to come back to normal
      this.log('will replace tracks after 1 second');
      setTimeout(() => {
        this.log('checking if still need to replace track');
        if (this._shouldAttemptRestart()) {
          // replace tracks.
          trackReAcquire().then(newTrack => {
            this.log('will replace tracks');
            this._trackSender.replaceTrack(newTrack);
          }).catch(err => {
            this.log('error, _trackReAcquireCallback failed', err);
          });
        } else {
          this.log('no need to replace track giving up');
        }
      }, 1000);
    }
  }

  _startWatching(start) {
    // eslint-disable-next-line no-undefined
    if (!document || !document.addEventListener || document.hidden === undefined) {
      this.log('This requires a modern browser that supports document Visibility');
      return;
    }

    if (start && !this._stateChangedCallback) {
      // we should stop watching once track stops.
      // this.once('stopped', () => this._startWatching(false));
      this.log('will start watching the track for state changes');
      this._stateChangedCallback = () => this._handleTrackStateChange();
      this.mediaStreamTrack.addEventListener('mute', this._stateChangedCallback);
      this.mediaStreamTrack.addEventListener('unmute', this._stateChangedCallback);
      this.mediaStreamTrack.addEventListener('ended', this._stateChangedCallback);
      document.addEventListener('visibilitychange', this._stateChangedCallback);
    } else if (!start && this._stateChangedCallback) {
      this.log('will stop watching the track for state changes');
      this.mediaStreamTrack.removeEventListener('mute', this._stateChangedCallback);
      this.mediaStreamTrack.removeEventListener('unmute', this._stateChangedCallback);
      this.mediaStreamTrack.removeEventListener('ended', this._stateChangedCallback);
      this._stateChangedCallback = null;
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
    // track was stopped, so stop watching for restartNeeded
    this._startWatching(false);
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
