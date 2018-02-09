'use strict';

const EventEmitter = require('events').EventEmitter;

/**
 * Represents recording state
 * @extends EventEmitter
 * @property {?boolean} isEnabled
 */
class RecordingSignaling extends EventEmitter {
  /**
   * Construct a {@link RecordingSignaling}.
   */
  constructor() {
    super();
    Object.defineProperties(this, {
      _isEnabled: {
        value: null,
        writable: true
      },
      isEnabled: {
        enumerable: true,
        get() {
          return this._isEnabled;
        }
      }
    });
  }

  /**
   * Disable the {@link RecordingSignaling} if it is not already disabled.
   * @return {this}
   */
  disable() {
    return this.enable(false);
  }

  /**
   * Enable (or disable) the {@link RecordingSignaling} if it is not already enabled
   * (or disabled).
   * @param {boolean} [enabled=true]
   * @return {this}
   */
  enable(enabled) {
    enabled = typeof enabled === 'boolean' ? enabled : true;
    if (this.isEnabled !== enabled) {
      this._isEnabled = enabled;
      this.emit('updated');
    }
    return this;
  }
}

/**
 * Emitted whenever the {@link RecordingSignaling} is updated
 * @event RecordingSignaling#updated
 */

module.exports = RecordingSignaling;
