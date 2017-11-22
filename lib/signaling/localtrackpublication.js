'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link LocalTrackPublicationSignaling}.
 * @class
 * @classdesc A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @param {DataTrackSender|MediaTrackSender} trackSender
 * @param {string} name
 * @property {?Error} error - non-null if publication failed
 */
function LocalTrackPublicationSignaling(trackSender, name) {
  var enabled = trackSender.kind === 'data'
    ? true
    : trackSender.track.enabled;
  TrackSignaling.call(this, name, trackSender.id, trackSender.kind, enabled);
  this.setTrackTransceiver(trackSender);
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
    }
  });
}

inherits(LocalTrackPublicationSignaling, TrackSignaling);

/**
 * Rejects the SID's deferred promise with the given Error.
 * @param {Error} error
 * @returns {this}
 */
LocalTrackPublicationSignaling.prototype.publishFailed = function publishFailed(error) {
  if (setError(this, error)) {
    this.emit('updated');
  }
  return this;
};

LocalTrackPublicationSignaling.prototype.setSid = function setSid(sid) {
  if (this._error) {
    return this;
  }
  return TrackSignaling.prototype.setSid.call(this, sid);
};

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
