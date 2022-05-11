'use strict';

const TrackSignaling = require('./track');

/**
 * A {@link RemoteTrackPublication} implementation
 * @extends TrackSignaling
 */
class RemoteTrackPublicationSignaling extends TrackSignaling {
  /**
   * Construct a {@link RemoteTrackPublicationSignaling}.
   * @param {Track.SID} sid
   * @param {string} name
   * @param {Track.Kind} kind
   * @param {boolean} isEnabled
   * @param {Track.Priority} priority
   * @param {boolean} isSwitchedOff
   * @param {number} rspVersion
   */
  constructor(sid, name, kind, isEnabled, priority, isSwitchedOff, rspVersion) {
    super(name, kind, isEnabled, priority);
    Object.defineProperties(this, {
      _isSwitchedOff: {
        value: isSwitchedOff,
        writable: true
      },
      _rspVersion: {
        value: rspVersion,
        writable: true
      }
    });
    this.setSid(sid);
  }

  /**
   * Whether the {@link RemoteTrackPublicationSignaling} is switched off.
   * @property {boolean}
   */
  get isSwitchedOff() {
    return this._isSwitchedOff;
  }

  /**
   * Return the RSP version of the {@link RemoteTrackPublicationSignaling} object.
   * @return {number}
   */
  get rspVersion() {
    return this._rspVersion;
  }

  /**
   * @param {Error} error
   * @returns {this}
   */
  subscribeFailed(error) {
    if (!this.error) {
      this._error = error;
      this.emit('updated');
    }
    return this;
  }

  /**
   * Update the publish {@link Track.Priority}.
   * @param {Track.Priority} priority
   * @returns {this}
   */
  setPriority(priority) {
    if (this._priority !== priority) {
      this._priority = priority;
      this.emit('updated');
    }
    return this;
  }

  /**
   * Updates track switch on/off state.
   * @param {boolean} isSwitchedOff
   * @returns {this}
   */
  setSwitchedOff(isSwitchedOff) {
    if (this._isSwitchedOff !== isSwitchedOff) {
      this._isSwitchedOff = isSwitchedOff;
      this.emit('updated');
    }
    return this;
  }
}


module.exports = RemoteTrackPublicationSignaling;
