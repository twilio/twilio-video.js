'use strict';

const TrackSignaling = require('./track');

/**
 * A {@link RemoteTrackPublication} implementation
 * @extends TrackSignaling
 */
class RemoteTrackPublicationSignaling extends TrackSignaling {
  /**
   * Construct a {@link RemoteTrackPublicationSignaling}.
   * @param {Track.SID} sid
   * @param {string} name
   * @param {Track.Kind} kind
   * @param {boolean} isEnabled
   * @param {Track.Priority} priority
   */
  constructor(sid, name, kind, isEnabled, priority) {
    super(name, kind, isEnabled, priority);
    this.setSid(sid);
  }

  /**
   * Whether the {@link RemoteTrackPublicationSignaling} is subscribed to.
   * @property {boolean}
   */
  get isSubscribed() {
    return !!this.trackTransceiver;
  }

  /**
   * @param {Error} error
   * @returns {this}
   */
  subscribeFailed(error) {
    if (!this.error) {
      this._error = error;
      this.emit('updated');
    }
    return this;
  }
}

module.exports = RemoteTrackPublicationSignaling;
