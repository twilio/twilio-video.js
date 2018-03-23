'use strict';

const Participant = require('./participant');

/**
 * A {@link RemoteParticipant} represents a remote {@link Participant} in a
 * {@link Room}.
 * @extends Participant
 * @property {Map<Track.SID, RemoteAudioTrack>} audioTracks -
 *    The {@link Participant}'s {@link RemoteAudioTrack}s.
 * @property {Map<Track.SID, RemoteDataTrack>} dataTracks -
 *    The {@link Participant}'s {@link RemoteDataTrack}s.
 * @property {Map<Track.SID, RemoteTrack>} tracks -
 *    The {@link Participant}'s {@link RemoteTrack}s
 * @property {Map<Track.SID, RemoteVideoTrack>} videoTracks -
 *    The {@link Participant}'s {@link RemoteVideoTrack}s.
 * @emits RemoteParticipant#trackAdded
 * @emits RemoteParticipant#trackDimensionsChanged
 * @emits RemoteParticipant#trackDisabled
 * @emits RemoteParticipant#trackEnabled
 * @emits RemoteParticipant#trackMessage
 * @emits RemoteParticipant#trackRemoved
 * @emits RemoteParticipant#trackStarted
 * @emits RemoteParticipant#trackSubscribed
 * @emits RemoteParticipant#trackSubscriptionFailed
 * @emits RemoteParticipant#trackUnsubscribed
 */
class RemoteParticipant extends Participant {
  /**
   * Construct a {@link RemoteParticipant}.
   * @param {ParticipantSignaling} signaling
   * @param {object} [options]
   */
  constructor(signaling, options) {
    super(signaling, options);
    this._handleTrackSignalingEvents();
    this.once('disconnected', this._unsubscribeTracks.bind(this));
  }

  toString() {
    return `[RemoteParticipant #${this._instanceId}${this.sid ? `: ${this.sid}` : ''}]`;
  }

  /**
   * @private
   */
  _addTrack(remoteTrack) {
    if (!super._addTrack.call(this, remoteTrack)) {
      return null;
    }
    this.emit('trackSubscribed', remoteTrack);
    return remoteTrack;
  }

  /**
   * @private
   */
  _unsubscribeTracks() {
    const tracks = Array.from(this.tracks.values());
    tracks.forEach(this._unsubscribeTrack, this);
  }

  /**
   * @private
   */
  _unsubscribeTrack(remoteTrack) {
    const unsubscribedTrack = this.tracks.get(remoteTrack.id);
    if (unsubscribedTrack) {
      unsubscribedTrack._unsubscribe();
      this.emit('trackUnsubscribed', unsubscribedTrack);
    }
  }

  /**
   * @private
   */
  _removeTrack(remoteTrack) {
    const unsubscribedTrack = this.tracks.get(remoteTrack.id);
    if (!unsubscribedTrack) {
      return null;
    }

    this._deleteTrack(unsubscribedTrack);
    unsubscribedTrack._unsubscribe();
    this.emit('trackUnsubscribed', unsubscribedTrack);
    this.emit('trackRemoved', unsubscribedTrack);

    return unsubscribedTrack;
  }
}

/**
 * A {@link RemoteTrack} was added by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was added
 * @event RemoteParticipant#trackAdded
 */

/**
 * One of the {@link RemoteParticipant}'s {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose dimensions changed
 * @event RemoteParticipant#trackDimensionsChanged
 */

/**
 * A {@link RemoteTrack} was disabled by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was disabled
 * @event RemoteParticipant#trackDisabled
 */

/**
 * A {@link RemoteTrack} was enabled by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was enabled
 * @event RemoteParticipant#trackEnabled
 */

/**
 * A message was received over one of the {@link RemoteParticipant}'s
 * {@link RemoteDataTrack}s.
 * @event RemoteParticipant#trackMessage
 * @param {string|ArrayBuffer} data
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} over which the
 *   message was received
 */

/**
 * A {@link RemoteTrack} was removed by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was removed
 * @event RemoteParticipant#trackRemoved
 */

/**
 * One of the {@link RemoteParticipant}'s {@link RemoteTrack}s started.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that started
 * @event RemoteParticipant#trackStarted
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was subscribed to.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was subscribed to
 * @event RemoteParticipant#trackSubscribed
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} could not be subscribed to.
 * @param {TwilioError} error - The reason the {@link RemoteTrack} could not be
 *   subscribed to
 * @param {RemoteTrackPublication} publication - The
 *   {@link RemoteTrackPublication} for the {@link RemoteTrack} that could not
 *   be subscribed to
 * @event RemoteParticipant#trackSubscriptionFailed
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was unsubscribed from.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was unsubscribed from
 * @event RemoteParticipant#trackUnsubscribed
 */

module.exports = RemoteParticipant;
