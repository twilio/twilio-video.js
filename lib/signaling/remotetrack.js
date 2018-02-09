'use strict';

const TrackSignaling = require('./track');

/**
 * A {@link RemoteTrack} implementation
 * @extends TrackSignaling
 * @property {boolean} isSubscribed
 * @property {?Error} error - non-null if subscription failed
 */
class RemoteTrackSignaling extends TrackSignaling {
  /**
   * Construct a {@link RemoteTrackSignaling}.
   * @param {Track.SID} sid
   * @param {string} name
   * @param {Track.ID} id
   * @param {Track.Kind} kind
   * @param {boolean} isEnabled
   */
  constructor(sid, name, id, kind, isEnabled) {
    super(name, id, kind, isEnabled);
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
      isSubscribed: {
        enumerable: true,
        get() {
          return !!this._trackTransceiver;
        }
      }
    });
    this.setSid(sid);
  }

  /**
   * @param {Error} error
   * @returns {this}
   */
  subscribeFailed(error) {
    if (!this._error) {
      this._error = error;
      this.emit('updated');
    }
    return this;
  }
}

module.exports = RemoteTrackSignaling;
