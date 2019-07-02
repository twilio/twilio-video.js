'use strict';

const { EventEmitter } = require('events');

/**
 * A {@link Track} implementation
 * @extends EventEmitter
 * @property {Track.Kind} kind
 * @property {string} name
 */
class TrackSignaling extends EventEmitter {
  /**
   * Construct a {@link TrackSignaling}.
   * @param {string} name
   * @param {Track.Kind} kind
   * @param {boolean} isEnabled
   * @param {Track.Priority} priority
   */
  constructor(name, kind, isEnabled, priority) {
    super();
    let sid = null;
    Object.defineProperties(this, {
      _error: {
        value: null,
        writable: true
      },
      _isEnabled: {
        value: isEnabled,
        writable: true
      },
      _priority: {
        value: priority,
        writable: true
      },
      _trackTransceiver: {
        value: null,
        writable: true
      },
      _sid: {
        get() {
          return sid;
        },
        set(_sid) {
          if (sid === null) {
            sid = _sid;
          }
        }
      },
      kind: {
        enumerable: true,
        value: kind
      },
      name: {
        enumerable: true,
        value: name
      }
    });
  }

  /**
   * Non-null if publication or subscription failed.
   * @property {?Error} error
   */
  get error() {
    return this._error;
  }

  /**
   * Whether the {@link TrackSignaling} is enabled.
   * @property {boolean}
   */
  get isEnabled() {
    return this._isEnabled;
  }

  /**
   * The {@link TrackSignaling}'s priority.
   * @property {Track.Priority}
   */
  get priority() {
    return this._priority;
  }

  /**
   * The {@link TrackSignaling}'s {@link Track.SID}.
   * @property {Track.SID}
   */
  get sid() {
    return this._sid;
  }

  /**
   * The {@link TrackSignaling}'s {@link TrackTransceiver}.
   * @property {TrackTransceiver}
   */
  get trackTransceiver() {
    return this._trackTransceiver;
  }

  /**
   * Disable the {@link TrackSignaling} if it is not already disabled.
   * @return {this}
   */
  disable() {
    return this.enable(false);
  }

  /**
   * Enable (or disable) the {@link TrackSignaling} if it is not already enabled
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

  /**
   * Set the {@link TrackTransceiver} on the {@link TrackSignaling}.
   * @param {TrackTransceiver} trackTransceiver
   * @returns {this}
   */

  setTrackTransceiver(trackTransceiver) {
    trackTransceiver = trackTransceiver || null;
    if (this.trackTransceiver !== trackTransceiver) {
      this._trackTransceiver = trackTransceiver;
      this.emit('updated');
    }
    return this;
  }

  /**
   * Set the SID on the {@link TrackSignaling} once.
   * @param {string} sid
   * @returns {this}
   */
  setSid(sid) {
    if (this.sid === null) {
      this._sid = sid;
      this.emit('updated');
    }
    return this;
  }
}

/**
 * Emitted whenever the {@link TrackSignaling} is updated
 * @event TrackSignaling#updated
 */

module.exports = TrackSignaling;
