'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('../util');

/**
 * Construct a {@link TrackSignaling}.
 * @class
 * @classdesc A {@link Track} implementation
 * @param {string} name
 * @param {Track.ID} id
 * @param {Track.Kind} kind
 * @param {boolean} isEnabled
 * @property {Track.ID} id
 * @property {boolean} isEnabled
 * @property {Track.Kind} kind
 * @property {?MediaStreamTrack|DataTrackTransceiver} mediaStreamTrackOrDataTrackTransceiver
 * @property {?Track.SID} sid
 */
function TrackSignaling(name, id, kind, isEnabled) {
  EventEmitter.call(this);
  var mediaStreamTrackOrDataTrackTransceiver;
  var sid = null;
  Object.defineProperties(this, {
    _isEnabled: {
      value: isEnabled,
      writable: true
    },
    _mediaStreamTrackOrDataTrackTransceiver: {
      get: function() {
        return mediaStreamTrackOrDataTrackTransceiver;
      },
      set: function(_mediaStreamTrackOrDataTrackTransceiver) {
        mediaStreamTrackOrDataTrackTransceiver = _mediaStreamTrackOrDataTrackTransceiver;
        this._mediaStreamTrackOrDataTrackTransceiverDeferred.resolve(mediaStreamTrackOrDataTrackTransceiver);
      }
    },
    _mediaStreamTrackOrDataTrackTransceiverDeferred: {
      value: util.defer()
    },
    _sid: {
      get: function() {
        return sid;
      },
      set: function(_sid) {
        if (sid === null) {
          sid = _sid;
          this._sidDeferred.resolve(sid);
        }
      }
    },
    _sidDeferred: {
      value: util.defer()
    },
    id: {
      enumerable: true,
      value: id
    },
    isEnabled: {
      enumerable: true,
      get: function() {
        return this._isEnabled;
      }
    },
    kind: {
      enumerable: true,
      value: kind
    },
    mediaStreamTrackOrDataTrackTransceiver: {
      enumerable: true,
      get: function() {
        return mediaStreamTrackOrDataTrackTransceiver;
      }
    },
    name: {
      enumerable: true,
      value: name
    },
    sid: {
      enumerable: true,
      get: function() {
        return sid;
      }
    }
  });
}

inherits(TrackSignaling, EventEmitter);

/**
 * Disable the {@link TrackSignaling} if it is not already disabled.
 * @return {this}
 */
TrackSignaling.prototype.disable = function disable() {
  return this.enable(false);
};

/**
 * Enable (or disable) the {@link TrackSignaling} if it is not already enabled
 * (or disabled).
 * @param {boolean} [enabled=true]
 * @return {this}
 */
TrackSignaling.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  if (this.isEnabled !== enabled) {
    this._isEnabled = enabled;
    this.emit('updated');
  }
  return this;
};

/**
 * Get the MediaStreamTrack or {@link DataTrackTransceiver} on the
 * {@link TrackSignaling}.
 * @returns {Promise<MediaStreamTrack|DataTrackTransceiver>}
 */
TrackSignaling.prototype.getMediaStreamTrackOrDataTrackTransceiver = function getMediaStreamTrackOrDataTrackTransceiver() {
  return this._mediaStreamTrackOrDataTrackTransceiverDeferred.promise;
};

/**
 * Get the SID on the {@link TrackSignaling}.
 * @returns {Promise<Track.SID>}
 */
TrackSignaling.prototype.getSid = function getSid() {
  return this._sidDeferred.promise;
};

/**
 * Set the MediaStreamTrack or {@link DataTrackTransceiver} on the {@link TrackSignaling}.
 * @param {MediaStreamTrack|DataTrackTransceiver} mediaStreamTrackOrDataTrackTransceiver
 * @returns {this}
 */
TrackSignaling.prototype.setMediaStreamTrackOrDataTrackTransceiver = function setMediaStreamTrackOrDataTrackTransceiver(mediaStreamTrackOrDataTrackTransceiver) {
  this._mediaStreamTrackOrDataTrackTransceiver = mediaStreamTrackOrDataTrackTransceiver;
  return this;
};

/**
 * Set the SID on the {@link TrackSignaling} once.
 * @param {string} sid
 * @returns {this}
 */
TrackSignaling.prototype.setSid = function setSid(sid) {
  if (this._sid === null) {
    this._sid = sid;
    this.emit('updated');
  }
  return this;
};

/**
 * Emitted whenever the {@link TrackSignaling} is updated
 * @event TrackSignaling#updated
 */

module.exports = TrackSignaling;
