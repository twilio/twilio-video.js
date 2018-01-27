'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('../util');

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
class TrackSignaling extends EventEmitter {
  constructor(name, id, kind, isEnabled) {
    super();
    let sid = null;
    let trackTransceiver = null;
    Object.defineProperties(this, {
      _isEnabled: {
        value: isEnabled,
        writable: true
      },
      _trackTransceiver: {
        get() {
          return trackTransceiver;
        },
        set(_trackTransceiver) {
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
        get() {
          return sid;
        },
        set(_sid) {
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
        get() {
          return this._isEnabled;
        }
      },
      kind: {
        enumerable: true,
        value: kind
      },
      trackTransceiver: {
        enumerable: true,
        get() {
          return trackTransceiver;
        }
      },
      name: {
        enumerable: true,
        value: name
      },
      sid: {
        enumerable: true,
        get() {
          return sid;
        }
      }
    });
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
   * Get the {@link TrackTransceiver} on the @link TrackSignaling}.
   * @returns {Promise<TrackTransceiver>}
   */
  getTrackTransceiver() {
    return this._trackTransceiverDeferred.promise;
  }

  /**
   * Set the {@link TrackTransceiver} on the {@link TrackSignaling}.
   * @param {TrackTransceiver} trackTransceiver
   * @returns {this}
   */
  setTrackTransceiver(trackTransceiver) {
    this._trackTransceiver = trackTransceiver;
    return this;
  }

  /**
   * Set the SID on the {@link TrackSignaling} once.
   * @param {string} sid
   * @returns {this}
   */
  setSid(sid) {
    if (this._sid === null) {
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
