'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('../util');

/**
 * Construct a {@link TrackSignaling}.
 * @class
 * @classdesc A {@link Track} implementation
 * @param {string} id
 * @param {string} kind - one of "audio" or "video"
 * @param {boolean} isEnabled
 * @property {string} id
 * @property {boolean} isEnabled
 * @property {string} kind
 * @property {?MediaStream} mediaStream
 * @property {?MediaStreamTrack} mediaStreamTrack
 */
function TrackSignaling(id, kind, isEnabled) {
  EventEmitter.call(this);
  var mediaStream;
  var mediaStreamTrack;
  Object.defineProperties(this, {
    _isEnabled: {
      value: isEnabled,
      writable: true
    },
    _mediaStream: {
      get: function() {
        return mediaStream;
      },
      set: function(_mediaStream) {
        mediaStream = _mediaStream;
        this._mediaStreamDeferred.resolve(mediaStream);
      }
    },
    _mediaStreamDeferred: {
      value: util.defer()
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
    mediaStream: {
      enumerable: true,
      get: function() {
        return mediaStream;
      }
    },
    mediaStreamTrack: {
      enumerable: true,
      get: function() {
        return mediaStreamTrack;
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
 * Get the MediaStreamTrack (and MediaStream) on the {@link TrackSignaling}.
 * @returns {Promise<[MediaStreamTrack, MediaStream]>}
 */
TrackSignaling.prototype.getMediaStreamTrack = function getMediaStreamTrack() {
  return Promise.all([
    this._mediaStreamTrackDeferred.promise,
    this._mediaStreamDeferred.promise
  ]);
};

/**
 * Set the MediaStreamTrack (and MediaStream) on the {@link TrackSignaling}.
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {MediaStream} mediaStream
 * @returns {this}
 */
TrackSignaling.prototype.setMediaStreamTrack = function setMediaStreamTrack(mediaStreamTrack, mediaStream) {
  this._mediaStream = mediaStream;
  this._mediaStreamTrack = mediaStreamTrack;
  return this;
};

/**
 * Emitted whenever the {@link TrackSignaling} is updated
 * @event TrackSignaling#updated
 */

module.exports = TrackSignaling;
