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
 * @property {?TrackTransceiver} trackTransceiver
 * @property {?Track.SID} sid
 */
function TrackSignaling(name, id, kind, isEnabled) {
  EventEmitter.call(this);
  var sid = null;
  var trackTransceiver = null;
  Object.defineProperties(this, {
    _isEnabled: {
      value: isEnabled,
      writable: true
    },
    _trackTransceiver: {
      get: function() {
        return trackTransceiver;
      },
      set: function(_trackTransceiver) {
        if (trackTransceiver === null) {
          trackTransceiver = _trackTransceiver;
          this._trackTransceiverDeferred.resolve(trackTransceiver);
        }
      }
    },
    _trackTransceiverDeferred: {
      value: util.defer()
    },
    _sid: {
      get: function() {
        return sid;
      },
      set: function(_sid) {
        if (sid === null) {
          sid = _sid;
        }
      }
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
    trackTransceiver: {
      enumerable: true,
      get: function() {
        return trackTransceiver;
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
 * Get the {@link TrackTransceiver} on the @link TrackSignaling}.
 * @returns {Promise<TrackTransceiver>}
 */
TrackSignaling.prototype.getTrackTransceiver = function getTrackTransceiver() {
  return this._trackTransceiverDeferred.promise;
};

/**
 * Set the {@link TrackTransceiver} on the {@link TrackSignaling}.
 * @param {TrackTransceiver} trackTransceiver
 * @returns {this}
 */
TrackSignaling.prototype.setTrackTransceiver = function setTrackTransceiver(trackTransceiver) {
  this._trackTransceiver = trackTransceiver;
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
