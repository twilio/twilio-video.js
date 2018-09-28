'use strict';

const Participant = require('./participant');
const { deprecateEvents } = require('./util');

/**
 * A {@link RemoteParticipant} represents a remote {@link Participant} in a
 * {@link Room}.
 * @extends Participant
 * @property {Map<Track.SID, RemoteAudioTrack>} audioTracks -
 *    The {@link Participant}'s {@link RemoteAudioTrack}s
 * @property {Map<Track.SID, RemoteAudioTrackPublication>} audioTrackPublications -
 *    The {@link Participant}'s {@link RemoteAudioTrackPublication}s
 * @property {Map<Track.SID, RemoteDataTrack>} dataTracks -
 *    The {@link Participant}'s {@link RemoteDataTrack}s
 * @property {Map<Track.SID, RemoteDataTrackPublication>} dataTrackPublications -
 *    The {@link Participant}'s {@link RemoteDataTrackPublication}s
 * @property {Map<Track.SID, RemoteTrack>} tracks -
 *    The {@link Participant}'s {@link RemoteTrack}s
 * @property {Map<Track.SID, RemoteTrackPublication>} trackPublications -
 *    The {@link Participant}'s {@link RemoteTrackPublication}s
 * @property {Map<Track.SID, RemoteVideoTrack>} videoTracks -
 *    The {@link Participant}'s {@link RemoteVideoTrack}s
 * @property {Map<Track.SID, RemoteVideoTrackPublication>} videoTrackPublications -
 *    The {@link Participant}'s {@link RemoteVideoTrackPublication}s
 * @emits RemoteParticipant#trackAdded
 * @emits RemoteParticipant#trackDimensionsChanged
 * @emits RemoteParticipant#trackDisabled
 * @emits RemoteParticipant#trackEnabled
 * @emits RemoteParticipant#trackMessage
 * @emits RemoteParticipant#trackPublished
 * @emits RemoteParticipant#trackRemoved
 * @emits RemoteParticipant#trackStarted
 * @emits RemoteParticipant#trackSubscribed
 * @emits RemoteParticipant#trackSubscriptionFailed
 * @emits RemoteParticipant#trackUnpublished
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

    deprecateEvents('RemoteParticipant', this, new Map([
      ['trackAdded', 'trackSubscribed'],
      ['trackRemoved', 'trackUnsubscribed']
    ]), this._log);

    this._handleTrackSignalingEvents();
    this.once('disconnected', this._unsubscribeTracks.bind(this));
  }

  toString() {
    return `[RemoteParticipant #${this._instanceId}${this.sid ? `: ${this.sid}` : ''}]`;
  }

  /**
   * @private
   * @param {RemoteTrack} remoteTrack
   * @param {RemoteTrackPublication} publication
   * @returns {?RemoteTrack}
   */
  _addTrack(remoteTrack, publication) {
    remoteTrack._setSid(publication.trackSid);
    if (!super._addTrack.call(this, remoteTrack)) {
      return null;
    }
    publication._subscribed(remoteTrack);
    this.emit('trackSubscribed', remoteTrack);
    return remoteTrack;
  }

  /**
   * @private
   * @param {RemoteTrackPublication} publication
   * @returns {?RemoteTrackPublication}
   */
  _addTrackPublication(publication) {
    const addedPublication = super._addTrackPublication(publication);
    if (!addedPublication) {
      return null;
    }
    this.emit('trackPublished', addedPublication);
    return addedPublication;
  }
  /**
   * @private
   */
  _getTrackPublicationEvents() {
    return [
      ...super._getTrackPublicationEvents(),
      ['subscriptionFailed', 'trackSubscriptionFailed']
    ];
  }

  /**
   * @private
   */
  _unsubscribeTracks() {
    this.trackPublications.forEach(publication => {
      if (publication.isSubscribed) {
        const track = publication.track;
        publication._unsubscribe();
        this.emit('trackUnsubscribed', track);
      }
    });
  }

  /**
   * @private
   * @param {RemoteTrack} remoteTrack
   * @param {RemoteTrackPublication} publication
   * @returns {?RemoteTrack}
   */
  _removeTrack(remoteTrack, publication) {
    const unsubscribedTrack = this.tracks.get(remoteTrack._id);
    if (!unsubscribedTrack) {
      return null;
    }

    this._deleteTrack(unsubscribedTrack);
    publication._unsubscribe();
    this.emit('trackUnsubscribed', unsubscribedTrack);
    this.emit('trackRemoved', unsubscribedTrack);
    return unsubscribedTrack;
  }

  /**
   * @private
   * @param {RemoteTrackPublication} publication
   * @returns {?RemoteTrackPublication}
   */
  _removeTrackPublication(publication) {
    const removedPublication = super._removeTrackPublication(publication);
    if (!removedPublication) {
      return null;
    }
    this.emit('trackUnpublished', removedPublication);
    return removedPublication;
  }
}

/**
 * A {@link RemoteTrack} was added by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was added
 * @event RemoteParticipant#trackAdded
 * @deprecated Use {@link RemoteParticipant#trackSubscribed} instead
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
 * A {@link RemoteTrack} was published by the {@link RemoteParticipant} after
 * connecting to the {@link Room}. This event is not emitted for
 * {@link RemoteTrack}s that were published while the {@link RemoteParticipant}
 * was connecting to the {@link Room}.
 * @event RemoteParticipant#trackPublished
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   which represents the published {@link RemoteTrack}
 * @example
 * function trackPublished(publication) {
 *   console.log(`Track ${publication.trackSid} was published`);
 * }
 *
 * room.on('participantConnected', participant => {
 *   // Handle RemoteTracks published while connecting to the Room.
 *   participant.trackPublications.forEach(trackPublished);
 *
 *   // Handle RemoteTracks published after connecting to the Room.
 *   participant.on('trackPublished', trackPublished);
 * });
 */

/**
 * A {@link RemoteTrack} was removed by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was removed
 * @event RemoteParticipant#trackRemoved
 * @deprecated Use {@link RemoteParticipant#trackUnsubscribed} instead
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
 * A {@link RemoteTrack} was unpublished by the {@link RemoteParticipant}.
 * @event RemoteParticipant#trackUnpublished
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   which represents the unpublished {@link RemoteTrack}
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was unsubscribed from.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was unsubscribed from
 * @event RemoteParticipant#trackUnsubscribed
 */

module.exports = RemoteParticipant;
