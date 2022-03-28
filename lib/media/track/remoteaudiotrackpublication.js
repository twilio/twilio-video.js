'use strict';

const RemoteTrackPublication = require('./remotetrackpublication');

/**
 * A {@link RemoteAudioTrackPublication} represents a {@link RemoteAudioTrack}
 * that has been published to a {@link Room}.
 * @property {Track.Kind} kind - "audio"
 * @property {?RemoteAudioTrack} track - unless you have subscribed to the
 *   {@link RemoteAudioTrack}, this property is null
 * @emits RemoteAudioTrackPublication#subscribed
 * @emits RemoteAudioTrackPublication#subscriptionFailed
 * @emits RemoteAudioTrackPublication#trackDisabled
 * @emits RemoteAudioTrackPublication#trackEnabled
 * @emits RemoteAudioTrackPublication#unsubscribed
 */
class RemoteAudioTrackPublication extends RemoteTrackPublication {
  /**
   * Construct a {@link RemoteAudioTrackPublication}.
   * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
   * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
   *   options
   */
  constructor(signaling, options) {
    super(signaling, options);
  }

  toString() {
    return `[RemoteAudioTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }
}

/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteAudioTrack}.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was subscribed to
 * @event RemoteAudioTrackPublication#subscribed
 */

/**
 * Your {@link LocalParticipant} failed to subscribe to the {@link RemoteAudioTrack}.
 * @param {TwilioError} error - the reason the {@link RemoteAudioTrack} could not be
 *   subscribed to
 * @event RemoteAudioTrackPublication#subscriptionFailed
 */

/**
 * The {@link RemoteAudioTrack} was disabled. It is fired only if <code>.isSubscribed</code>
 * is set to <code>true</code>.
 * @deprecated Use <a href="event:trackSwitchedOff"><code>trackSwitchedOff</code></a> (<code>track.switchOffReason === "disabled-by-publisher"</code>) instead
 * @event RemoteAudioTrackPublication#trackDisabled
 */

/**
 * The {@link RemoteAudioTrack} was enabled. It is fired only if <code>.isSubscribed</code>
 * @deprecated Use <a href="event:trackSwitchedOn"><code>trackSwitchedOn</code></a> instead
 * is set to <code>true</code>.
 * @event RemoteAudioTrackPublication#trackEnabled
 */

/**
 * The {@link RemoteAudioTrack} was switched off. The media server stops sending media for
 * the {@link RemoteAudioTrack} until it is switched back on. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>true</code> and <code>switchOffReason</code>
 * is set to a {@link TrackSwitchOffReason}. Also, the <code>mediaStreamTrack</code> property
 * is set to <code>null</code>.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was switched off
 * @param {?TrackSwitchOffReason} switchOffReason - the reason the {@link RemoteAudioTrack}
 *   was switched off
 * @event RemoteAudioTrackPublication#trackSwitchedOff
 */

/**
 * The {@link RemoteAudioTrack} was switched on. The media server starts sending media for
 * the {@link RemoteAudioTrack} until it is switched off. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>false</code> and <code>switchOffReason</code>
 * is set to <code>null</code>. Also, the <code>mediaStreamTrack</code> property is set to a
 * MediaStreamTrack that is the source of the {@link RemoteAudioTrack}'s media.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was switched on
 * @event RemoteAudioTrackPublication#trackSwitchedOn
 */

/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteAudioTrack}.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was unsubscribed from
 * @event RemoteAudioTrackPublication#unsubscribed
 */

module.exports = RemoteAudioTrackPublication;
