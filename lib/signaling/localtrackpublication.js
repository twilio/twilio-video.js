'use strict';

const TrackSignaling = require('./track');

/**
 * A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @property {Track.ID} id
 */
class LocalTrackPublicationSignaling extends TrackSignaling {
  /**
   * Construct a {@link LocalTrackPublicationSignaling}. {@link TrackSenders}
   * are always cloned.
   * @param {DataTrackSender|MediaTrackSender} trackSender - the {@link TrackSender}
   *   of the {@link LocalTrack} to be published
   * @param {string} name - the name of the {@link LocalTrack} to be published
   * @param {Track.Priority} priority - initial {@link Track.Priority}
   */
  constructor(trackSender, name, priority) {
    trackSender = trackSender.clone();
    const enabled = trackSender.kind === 'data' ? true : trackSender.track.enabled;
    super(name, trackSender.kind, enabled, priority);
    this.setTrackTransceiver(trackSender);
    Object.defineProperties(this, {
      _updatedPriority: {
        value: priority,
        writable: true
      },
      id: {
        enumerable: true,
        value: trackSender.id
      }
    });
  }

  /**
   * The updated {@link Track.Priority} of the {@link LocalTrack}.
   * @property {Track.priority}
   */
  get updatedPriority() {
    return this._updatedPriority;
  }

  /**
   * Enable (or disable) the {@link LocalTrackPublicationSignaling} if it is not
   * already enabled (or disabled). This also updates the cloned
   * {@link MediaTrackSender}'s MediaStreamTracks `enabled` state.
   * @param {boolean} [enabled=true]
   * @return {this}
   */
  enable(enabled) {
    enabled = typeof enabled === 'boolean' ? enabled : true;
    this.trackTransceiver.track.enabled = enabled;
    return super.enable(enabled);
  }

  /**
   * Rejects the SID's deferred promise with the given Error.
   * @param {Error} error
   * @returns {this}
   */
  publishFailed(error) {
    if (setError(this, error)) {
      this.emit('updated');
    }
    return this;
  }

  /**
   * Update the {@link Track.Priority} of the published {@link LocalTrack}.
   * @param {Track.priority} priority
   * @returns {this}
   */
  setPriority(priority) {
    if (this._updatedPriority !== priority) {
      this._updatedPriority = priority;
      this.emit('updated');
    }
    return this;
  }

  /**
   * Set the published {@link LocalTrack}'s {@link Track.SID}.
   * @param {Track.SID} sid
   * @returns {this}
   */
  setSid(sid) {
    if (this._error) {
      return this;
    }
    return super.setSid.call(this, sid);
  }

  /**
   * Stop the cloned {@link TrackSender}.
   * @returns {void}
   */
  stop() {
    this.trackTransceiver.stop();
  }
}

/**
 * @param {LocalTrackPublication} publication
 * @param {Error} error
 * @returns {boolean} updated
 */
function setError(publication, error) {
  if (publication._sid !== null || publication._error) {
    return false;
  }
  publication._error = error;
  return true;
}

module.exports = LocalTrackPublicationSignaling;
