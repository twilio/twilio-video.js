'use strict';

const mixinRemoteMediaTrack = require('./remotemediatrack');
const VideoTrack = require('./videotrack');

const RemoteMediaVideoTrack = mixinRemoteMediaTrack(VideoTrack);

/**
 * A {@link RemoteVideoTrack} represents a {@link VideoTrack} published to a
 * {@link Room} by a {@link RemoteParticipant}.
 * @extends VideoTrack
 * @property {boolean} isSubscribed - Whether the {@link RemoteVideoTrack} is
 *   currently subscribed to
 * @property {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
 * @emits RemoteVideoTrack#disabled
 * @emits RemoteVideoTrack#enabled
 * @emits RemoteVideoTrack#started
 * @emits RemoteVideoTrack#unsubscribed
 */
class RemoteVideoTrack extends RemoteMediaVideoTrack {
  /**
   * Construct a {@link RemoteVideoTrack}.
   * @param {MediaTrackReceiver} mediaTrackReceiver - A video MediaStreamTrack container
   * @param {RemoteTrackSignaling} signaling - The {@link Track} signaling
   * @param {{log: Log}} options - The {@link RemoteTrack} options
   */
  constructor(mediaTrackReceiver, signaling, options) {
    super(mediaTrackReceiver, signaling, options);
  }

  toString() {
    return `[RemoteVideoTrack #${this._instanceId}: ${this.sid}]`;
  }

  /**
   * @private
   */
  _unsubscribe() {
    return super._unsubscribe.apply(this, arguments);
  }
}

/**
 * The {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose
 *   dimensions changed
 * @event RemoteVideoTrack#dimensionsChanged
 */

/**
 * The {@link RemoteVideoTrack} was disabled, i.e. "paused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   disabled
 * @event RemoteVideoTrack#disabled
 */

/**
 * The {@link RemoteVideoTrack} was enabled, i.e. "unpaused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   enabled
 * @event RemoteVideoTrack#enabled
 */

/**
 * The {@link RemoteVideoTrack} was unsubscribed from.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   unsubscribed from
 * @event RemoteVideoTrack#unsubscribed
 */

module.exports = RemoteVideoTrack;
