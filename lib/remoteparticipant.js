'use strict';

const Participant = require('./participant');

/**
 * A {@link RemoteParticipant} represents a remote {@link Participant} in a
 * {@link Room}.
 * @extends Participant
 * @property {Map<Track.SID, RemoteAudioTrackPublication>} audioTracks -
 *    The {@link Participant}'s {@link RemoteAudioTrackPublication}s
 * @property {Map<Track.SID, RemoteDataTrackPublication>} dataTracks -
 *    The {@link Participant}'s {@link RemoteDataTrackPublication}s
 * @property {Map<Track.SID, RemoteTrackPublication>} tracks -
 *    The {@link Participant}'s {@link RemoteTrackPublication}s
 * @property {Map<Track.SID, RemoteVideoTrackPublication>} videoTracks -
 *    The {@link Participant}'s {@link RemoteVideoTrackPublication}s
 * @emits RemoteParticipant#reconnected
 * @emits RemoteParticipant#reconnecting
 * @emits RemoteParticipant#trackDimensionsChanged
 * @emits RemoteParticipant#trackDisabled
 * @emits RemoteParticipant#trackEnabled
 * @emits RemoteParticipant#trackMessage
 * @emits RemoteParticipant#trackPublished
 * @emits RemoteParticipant#trackPublishPriorityChanged
 * @emits RemoteParticipant#trackStarted
 * @emits RemoteParticipant#trackSubscribed
 * @emits RemoteParticipant#trackSubscriptionFailed
 * @emits RemoteParticipant#trackSwitchedOff
 * @emits RemoteParticipant#trackSwitchedOn
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
   * @param {Track.ID} id
   * @returns {?RemoteTrack}
   */
  _addTrack(remoteTrack, publication, id) {
    if (!super._addTrack(remoteTrack, id)) {
      return null;
    }
    publication._subscribed(remoteTrack);
    this.emit('trackSubscribed', remoteTrack, publication);
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
      ['subscriptionFailed', 'trackSubscriptionFailed'],
      ['trackDisabled', 'trackDisabled'],
      ['trackEnabled', 'trackEnabled'],
      ['publishPriorityChanged', 'trackPublishPriorityChanged'],
      ['trackSwitchedOff', 'trackSwitchedOff'],
      ['trackSwitchedOn', 'trackSwitchedOn']
    ];
  }

  /**
   * @private
   */
  _unsubscribeTracks() {
    this.tracks.forEach(publication => {
      if (publication.isSubscribed) {
        const track = publication.track;
        publication._unsubscribe();
        this.emit('trackUnsubscribed', track, publication);
      }
    });
  }

  /**
   * @private
   * @param {RemoteTrack} remoteTrack
   * @param {RemoteTrackPublication} publication
   * @param {Track.ID} id
   * @returns {?RemoteTrack}
   */
  _removeTrack(remoteTrack, publication, id) {
    const unsubscribedTrack = this._tracks.get(id);
    if (!unsubscribedTrack) {
      return null;
    }

    super._removeTrack(unsubscribedTrack, id);
    publication._unsubscribe();
    this.emit('trackUnsubscribed', unsubscribedTrack, publication);
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
 * The {@link RemoteParticipant} has reconnected to the {@link Room} after a signaling connection disruption.
 * @event RemoteParticipant#reconnected
 */

/**
 * The {@link RemoteParticipant} is reconnecting to the {@link Room} after a signaling connection disruption.
 * @event RemoteParticipant#reconnecting
 */

/**
 * One of the {@link RemoteParticipant}'s {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose dimensions changed
 * @event RemoteParticipant#trackDimensionsChanged
 */

/**
 * A {@link RemoteTrack} was disabled by the {@link RemoteParticipant}.
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication} associated with the disabled {@link RemoteTrack}
 * @event RemoteParticipant#trackDisabled
 */

/**
 * A {@link RemoteTrack} was enabled by the {@link RemoteParticipant}.
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication} associated with the enabled {@link RemoteTrack}
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
 * One of the {@link RemoteParticipant}'s {@link RemoteTrack}s started.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that started
 * @event RemoteParticipant#trackStarted
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was subscribed to.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was subscribed to
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was subscribed to
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
 * The {@link RemoteTrackPublication}'s publish {@link Track.Priority} was changed by the
 * {@link RemoteParticipant}.
 * @param {Track.Priority} priority - the {@link RemoteTrack}'s new publish
 *   {@link Track.Priority};
 * @param {RemoteTrackPublication} publication - The
 *   {@link RemoteTrackPublication} for the {@link RemoteTrack} that changed priority
 * @event RemoteParticipant#trackPublishPriorityChanged
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was subscribed to.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was switched off
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was switched off
 * @event RemoteParticipant#trackSwitchedOff
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was switched on.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was switched on.
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was switched on
 * @event RemoteParticipant#trackSwitchedOn
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
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was unsubscribed from
 * @event RemoteParticipant#trackUnsubscribed
 */

module.exports = RemoteParticipant;
