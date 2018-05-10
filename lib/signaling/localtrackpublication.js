'use strict';

const TrackSignaling = require('./track');

/**
 * A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @property {?Error} error - non-null if publication failed
 */
class LocalTrackPublicationSignaling extends TrackSignaling {
  /**
   * Construct a {@link LocalTrackPublicationSignaling}. Any
   * {@link MediaTrackSender}s will be cloned.
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @param {string} name
   */
  constructor(trackSender, name) {
    const { id, kind } = trackSender;
    const enabled = trackSender.kind === 'data' ? true : trackSender.track.enabled;
    super(name, id, kind, enabled);
    this.setTrackTransceiver(trackSender.clone ? trackSender.clone() : trackSender);
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
      }
    });
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

  setSid(sid) {
    if (this._error) {
      return this;
    }
    return super.setSid.call(this, sid);
  }

  /**
   * Stop the cloned {@link MediaTrackSender}'s MediaStreamTrack.
   * @returns {void}
   */
  stop() {
    this.trackTransceiver.track.stop();
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
