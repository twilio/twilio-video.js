'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('../util');

/**
 * Construct a {@link TrackSignaling}.
 * @class
 * @classdesc A {@link Track} implementation
 * @param {Track.ID} id
 * @param {string} kind - one of "audio" or "video"
 * @param {boolean} isEnabled
 * @property {Track.ID} id
 * @property {boolean} isEnabled
 * @property {string} kind
 * @property {?MediaStreamTrack} mediaStreamTrack
 * @property {?Track.SID} sid
 */
function TrackSignaling(id, kind, isEnabled) {
  EventEmitter.call(this);
  var mediaStreamTrack;
  var sid = null;
  Object.defineProperties(this, {
    _isEnabled: {
      value: isEnabled,
      writable: true
    },
    _mediaStreamTrack: {
      get: function() {
        return mediaStreamTrack;
      },
      set: function(_mediaStreamTrack) {
        mediaStreamTrack = _mediaStreamTrack;
        this._mediaStreamTrackDeferred.resolve(mediaStreamTrack);
      }
    },
    _mediaStreamTrackDeferred: {
      value: util.defer()
    },
    _sid: {
      get: function() {
        return sid;
      },
      set: function(_sid) {
        sid = _sid;
        this._sidDeferred.resolve(sid);
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
    mediaStreamTrack: {
      enumerable: true,
      get: function() {
        return mediaStreamTrack;
      }
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
 * Get the MediaStreamTrack on the {@link TrackSignaling}.
 * @returns {Promise<MediaStreamTrack>}
 */
TrackSignaling.prototype.getMediaStreamTrack = function getMediaStreamTrack() {
  return this._mediaStreamTrackDeferred.promise;
};

/**
 * Get the SID on the {@link TrackSignaling}.
 * @returns {Promise<Track.SID>}
 */
TrackSignaling.prototype.getSid = function getSid() {
  return this._sidDeferred.promise;
};

/**
 * Set the MediaStreamTrack on the {@link TrackSignaling}.
 * @param {MediaStreamTrack} mediaStreamTrack
 * @returns {this}
 */
TrackSignaling.prototype.setMediaStreamTrack = function setMediaStreamTrack(mediaStreamTrack) {
  this._mediaStreamTrack = mediaStreamTrack;
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
