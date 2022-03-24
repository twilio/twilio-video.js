'use strict';

const AudioTrack = require('./audiotrack');
const mixinRemoteMediaTrack = require('./remotemediatrack');

const RemoteMediaAudioTrack = mixinRemoteMediaTrack(AudioTrack);

/**
 * A {@link RemoteAudioTrack} represents an {@link AudioTrack} published to a
 * {@link Room} by a {@link RemoteParticipant}.
 * @extends AudioTrack
 * @property {boolean} isEnabled - <code>Deprecated: Use (.isSwitchedOff && .switchOffReason === "disabled-by-publisher") instead</code>
 *   Whether the {@link RemoteAudioTrack} is enabled
 * @property {boolean} isSwitchedOff - Whether the {@link RemoteAudioTrack} is switched off
 * @property {?TrackSwitchOffReason} switchOffReason - The reason for the {@link RemoteAudioTrack} being switched off;
 *   If switched on, it is set to <code>null</code>; The {@link RemoteAudioTrack} is initially switched off with this
 *   property set to <code>disabled-by-subscriber</code>
 * @property {Track.SID} sid - The {@link RemoteAudioTrack}'s SID
 * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteAudioTrack}
 * @emits RemoteAudioTrack#disabled
 * @emits RemoteAudioTrack#enabled
 * @emits RemoteAudioTrack#started
 * @emits RemoteAudioTrack#switchedOff
 * @emits RemoteAudioTrack#switchedOn
 */
class RemoteAudioTrack extends RemoteMediaAudioTrack {
  /**
   * Construct a {@link RemoteAudioTrack}.
   * @param {Track.SID} sid - The {@link RemoteAudioTrack}'s SID
   * @param {?MediaTrackReceiver} mediaTrackReceiver - An audio MediaStreamTrack container
   * @param {boolean} isEnabled - Whether the {@link RemoteAudioTrack} is enabled
   * @param {boolean} isSwitchedOff - Whether the {@link RemoteAudioTrack} is switched off
   * @param {?string} switchOffReason - The reason the {@link RemoteAudioTrack} is switched off
   * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
   *  {@link Track.Priority} of the {@link RemoteAudioTrack}
   * @param {function(ClientRenderHint): void} setRenderHint - Set render hints.
   * @param {{log: Log, name: string}} options - The {@link RemoteTrack} options
   */
  constructor(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, switchOffReason, setPriority, setRenderHint, options) {
    super('audio', sid, mediaTrackReceiver, isEnabled, isSwitchedOff, switchOffReason, setPriority, setRenderHint, options);
  }

  toString() {
    return `[RemoteAudioTrack #${this._instanceId}: ${this.sid}]`;
  }

  /**
   * Update the subscribe {@link Track.Priority} of the {@link RemoteAudioTrack}.
   * @param {?Track.Priority} priority - the new subscribe {@link Track.Priority};
   *   Currently setPriority has no effect on audio tracks.
   * @returns {this}
   * @throws {RangeError}
   */
  setPriority(priority) {
    return super.setPriority(priority);
  }
}

/**
 * The {@link RemoteAudioTrack} was disabled, i.e. "muted".
 * @deprecated Use <a href="#event:switchedOff"><code>switchedOff</code></a> (<code>.switchOffReason === "disabled-by-publisher"</code>) instead
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   disabled
 * @event RemoteAudioTrack#disabled
 */

/**
 * The {@link RemoteAudioTrack} was enabled, i.e. "unmuted".
 * @deprecated Use <a href="#event:switchedOn"><code>switchedOn</code></a> instead
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   enabled
 * @event RemoteAudioTrack#enabled
 */

/**
 * The {@link RemoteAudioTrack} started. This means there is enough audio data
 * to begin playback.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that started
 * @event RemoteAudioTrack#started
 */

/**
 * A {@link RemoteAudioTrack} was switched off. The media server stops sending media for the
 * {@link RemoteAudioTrack} until it is switched back on. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>true</code> and <code>switchOffReason</code> is
 * set to a {@link TrackSwitchOffReason}. Also, the <code>mediaStreamTrack</code> property is
 * set to <code>null</code>.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   switched off
 * @param {?TrackSwitchOffReason} switchOffReason - The reason the {@link RemoteAudioTrack}
 *   was switched off
 * @event RemoteAudioTrack#switchedOff
 */

/**
 * A {@link RemoteAudioTrack} was switched on. The media server starts sending media for the
 * {@link RemoteAudioTrack} until it is switched off. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>false</code> and <code>switchOffReason</code>
 * is set to <code>null</code>. Also, the <code>mediaStreamTrack</code> property is set to a
 * MediaStreamTrack that is the source of the {@link RemoteAudioTrack}'s media.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   switched on
 * @event RemoteAudioTrack#switchedOn
 */

module.exports = RemoteAudioTrack;
