'use strict';

const RemoteTrackPublication = require('./remotetrackpublication');

/**
 * A {@link RemoteVideoTrackPublication} represents a {@link RemoteVideoTrack}
 * that has been published to a {@link Room}.
 * @property {Track.Kind} kind - "video"
 * @property {?RemoteVideoTrack} track - unless you have subscribed to the
 *   {@link RemoteVideoTrack}, this property is null
 * @emits RemoteVideoTrackPublication#subscribed
 * @emits RemoteVideoTrackPublication#subscriptionFailed
 * @emits RemoteVideoTrackPublication#trackDisabled
 * @emits RemoteVideoTrackPublication#trackEnabled
 * @emits RemoteVideoTrackPublication#unsubscribed
 */
class RemoteVideoTrackPublication extends RemoteTrackPublication {
  /**
   * Construct a {@link RemoteVideoTrackPublication}.
   * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
   * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
   *   options
   */
  constructor(signaling, options) {
    super(signaling, options);
  }

  toString() {
    return `[RemoteVideoTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }
}

/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteVideoTrack}.
 * @param {RemoteVideoTrack} track - the {@link RemoteVideoTrack} that was subscribed to
 * @event RemoteVideoTrackPublication#subscribed
 */

/**
 * Your {@link LocalParticipant} failed to subscribe to the {@link RemoteVideoTrack}.
 * @param {TwilioError} error - the reason the {@link RemoteVideoTrack} could not be
 *   subscribed to
 * @event RemoteVideoTrackPublication#subscriptionFailed
 */

/**
 * The {@link RemoteVideoTrack} was disabled. It is fired only if <code>.isSubscribed</code>
 * is set to <code>true</code> (Deprecated only for large group Rooms).
 * @deprecated Use <a href="event:trackSwitchedOff"><code>trackSwitchedOff</code></a> (<code>track.switchOffReason === "disabled-by-publisher"</code>) instead
 * @event RemoteVideoTrackPublication#trackDisabled
 */

/**
 * The {@link RemoteVideoTrack} was enabled. It is fired only if <code>.isSubscribed</code>
 * is set to <code>true</code> (Deprecated only for large group Rooms).
 * @deprecated Use <a href="event:trackSwitchedOn"><code>trackSwitchedOn</code></a> instead
 * @event RemoteVideoTrackPublication#trackEnabled
 */

/**
 * The {@link RemoteVideoTrack} was switched off. The media server stops sending media for
 * the {@link RemoteVideoTrack} until it is switched back on. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>true</code> and <code>switchOffReason</code>
 * is set to a {@link TrackSwitchOffReason} in large group Rooms (<code>switchOffReason</code> is
 * <code>null</code> non-large group Rooms). Also, if the {@link RemoteVideoTrack} receives audio
 * media, the <code>mediaStreamTrack</code> property is set to <code>null</code>. (only in large
 * group Rooms)
 * @param {RemoteVideoTrack} track - the {@link RemoteVideoTrack} that was switched off
 * @param {?TrackSwitchOffReason} switchOffReason - the reason the {@link RemoteVideoTrack}
 *   was switched off
 * @event RemoteVideoTrackPublication#trackSwitchedOff
 */

/**
 * The {@link RemoteVideoTrack} was switched on. The media server starts sending media for
 * the {@link RemoteVideoTrack} until it is switched off. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>false</code> and <code>switchOffReason</code>
 * is set to <code>null</code>. Also, the <code>mediaStreamTrack</code> property is set to a
 * MediaStreamTrack that is the source of the {@link RemoteVideoTrack}'s media.
 * @param {RemoteVideoTrack} track - the {@link RemoteVideoTrack} that was switched on
 * @event RemoteVideoTrackPublication#trackSwitchedOn
 */

/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteVideoTrack}.
 * @param {RemoteVideoTrack} track - the {@link RemoteVideoTrack} that was unsubscribed from
 * @event RemoteVideoTrackPublication#unsubscribed
 */

module.exports = RemoteVideoTrackPublication;
