import { AudioTrack } from './AudioTrack';
import { LocalTrackOptions } from './LocalTrackOptions';
import { Track } from './Track';

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
export class LocalAudioTrack extends AudioTrack {
  /**
   * Construct a {@link LocalAudioTrack} from a MediaStreamTrack.
   * @param {MediaStreamTrack} mediaStreamTrack - An audio MediaStreamTrack
   * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
   */
  constructor(mediaStreamTrack: MediaStreamTrack, options?: LocalTrackOptions);

  id: Track.ID;
  isStopped: boolean;

  /**
   * Disable the {@link LocalAudioTrack}. This is effectively "mute".
   * @returns {this}
   * @fires LocalAudioTrack#disabled
   */
  disable(): LocalAudioTrack;

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
  enable(enabled?: boolean): LocalAudioTrack;

  /**
   * Restart the {@link LocalAudioTrack}. This stops the existing MediaStreamTrack
   * and creates a new MediaStreamTrack. If the {@link LocalAudioTrack} is being published
   * to a {@link Room}, then all the {@link RemoteParticipant}s will start receiving media
   * from the newly created MediaStreamTrack. You can access the new MediaStreamTrack via
   * the <code>mediaStreamTrack</code> property. If you want to listen to events on
   * the MediaStreamTrack directly, please do so in the "started" event handler. Also,
   * the {@link LocalAudioTrack}'s ID is no longer guaranteed to be the same as the
   * underlying MediaStreamTrack's ID.
   * @param {MediaTrackConstraints} [constraints] - The optional <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints" target="_blank">MediaTrackConstraints</a>
   *   for restarting the {@link LocalAudioTrack}; If not specified, then the current MediaTrackConstraints
   *   will be used; If <code>{}</code> (empty object) is specified, then the default MediaTrackConstraints
   *   will be used
   * @returns {Promise<void>} Rejects with a TypeError if the {@link LocalAudioTrack} was not created
   *   using an one of <code>createLocalAudioTrack</code>, <code>createLocalTracks</code> or <code>connect</code>;
   *   Also rejects with the <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Exceptions" target="_blank">DOMException</a>
   *   raised by <code>getUserMedia</code> when it fails
   * @fires LocalAudioTrack#stopped
   * @fires LocalAudioTrack#started
   * @example
   * const { connect, createLocalAudioTrack } = require('twilio-video');
   *
   * // Create a LocalAudioTrack that captures audio from a USB microphone.
   * createLocalAudioTrack({ deviceId: 'usb-mic-id' }).then(function(localAudioTrack) {
   *   return connect('token', {
   *     name: 'my-cool-room',
   *     tracks: [localAudioTrack]
   *   });
   * }).then(function(room) {
   *   // Restart the LocalAudioTrack to capture audio from the default microphone.
   *   const localAudioTrack = Array.from(room.localParticipant.audioTracks.values())[0].track;
   *   return localAudioTrack.restart({ deviceId: 'default-mic-id' });
   * });
   */
  restart(constraints?: MediaTrackConstraints): Promise<void>;

  /**
   * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
   * {@link LocalAudioTrack}, you should unpublish it after stopping.
   * @returns {this}
   * @fires LocalAudioTrack#stopped
   */
  stop(): LocalAudioTrack;
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
 * The {@link LocalAudioTrack} stopped, either because {@link LocalAudioTrack#stop}
 * or {@link LocalAudioTrack#restart} was called or because the underlying
 * MediaStreamTrack ended.
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that stopped
 * @event LocalAudioTrack#stopped
 */
