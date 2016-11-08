'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct a {@link RecordingSignaling}.
 * @class
 * @classdesc Represents recording state
 * @property {?boolean} isEnabled
 */
function RecordingSignaling() {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _isEnabled: {
      value: null,
      writable: true
    },
    isEnabled: {
      enumerable: true,
      get: function() {
        return this._isEnabled;
      }
    }
  });
}

inherits(RecordingSignaling, EventEmitter);

/**
 * Disable the {@link RecordingSignaling} if it is not already disabled.
 * @return {this}
 */
RecordingSignaling.prototype.disable = function disable() {
  return this.enable(false);
};

/**
 * Enable (or disable) the {@link RecordingSignaling} if it is not already enabled
 * (or disabled).
 * @param {boolean} [enabled=true]
 * @return {this}
 */
RecordingSignaling.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  if (this.isEnabled !== enabled) {
    this._isEnabled = enabled;
    this.emit('updated');
  }
  return this;
};

/**
 * Emitted whenever the {@link RecordingSignaling} is updated
 * @event RecordingSignaling#updated
 */

module.exports = RecordingSignaling;
