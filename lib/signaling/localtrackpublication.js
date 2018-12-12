'use strict';

const TrackSignaling = require('./track');

/**
 * A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @property {?Error} error - non-null if publication failed
 * @property {Track.ID} id
 */
class LocalTrackPublicationSignaling extends TrackSignaling {
  /**
   * Construct a {@link LocalTrackPublicationSignaling}.
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @param {string} name
   */
  constructor(trackSender, name) {
    const enabled = trackSender.kind === 'data'
      ? true
      : trackSender.track.enabled;
    super(name, trackSender.kind, enabled);
    this.setTrackTransceiver(trackSender);
    Object.defineProperties(this, {
      _error: {
        value: null,
        writable: true
      },
      error: {
        enumerable: true,
        get() {
          return this._error;
        }
      },
      id: {
        enumerable: true,
        value: trackSender.id
      }
    });
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

  setSid(sid) {
    if (this._error) {
      return this;
    }
    return super.setSid.call(this, sid);
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
