'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link LocalTrackPublicationSignaling}.
 * @class
 * @classdesc A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @param {MediaStreamTrack|DataTrackSender} mediaStreamTrackOrDataTrackSender
 * @param {string} name
 * @property {?Error} error - non-null if publication failed
 */
function LocalTrackPublicationSignaling(mediaStreamTrackOrDataTrackSender, name) {
  var enabled = mediaStreamTrackOrDataTrackSender.kind === 'data'
    ? true
    : mediaStreamTrackOrDataTrackSender.enabled;
  TrackSignaling.call(this,
    name,
    mediaStreamTrackOrDataTrackSender.id,
    mediaStreamTrackOrDataTrackSender.kind,
    enabled);
  this.setMediaStreamTrackOrDataTrackTransceiver(mediaStreamTrackOrDataTrackSender);
  var error = null;
  Object.defineProperties(this, {
    _error: {
      get: function() {
        return error;
      },
      set: function(_error) {
        if (this._sid === null && !error) {
          error = _error;
          this._sidDeferred.reject(error);
        }
      }
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
  if (this._sid === null && !this._error) {
    this._error = error;
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

module.exports = LocalTrackPublicationSignaling;
