'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link RemoteTrackSignaling}.
 * @class
 * @classdesc A {@link RemoteTrack} implementation
 * @extends TrackSignaling
 * @param {Track.SID} sid
 * @param {string} name
 * @param {Track.ID} id
 * @param {Track.Kind} kind
 * @param {boolean} isEnabled
 * @property {boolean} isSubscribed
 * @property {?Error} error - non-null if subscription failed
 */
function RemoteTrackSignaling(sid, name, id, kind, isEnabled) {
  TrackSignaling.call(this, name, id, kind, isEnabled);
  Object.defineProperties(this, {
    _error: {
      value: null,
      writable: true
    },
    error: {
      enumerable: true,
      get: function() {
        return this._error;
      }
    },
    isSubscribed: {
      enumerable: true,
      get: function() {
        return !!this._trackTransceiver;
      }
    }
  });
  this.setSid(sid);
}

inherits(RemoteTrackSignaling, TrackSignaling);

/**
 * @param {Error} error
 * @returns {this}
 */
RemoteTrackSignaling.prototype.subscribeFailed = function subscribeFailed(error) {
  if (!this._error) {
    this._error = error;
    this.emit('updated');
  }
  return this;
};

module.exports = RemoteTrackSignaling;
