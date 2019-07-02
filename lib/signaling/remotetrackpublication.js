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
   */
  constructor(sid, name, kind, isEnabled) {
    super(name, kind, isEnabled);
    Object.defineProperties(this, {
      _error: {
        value: null,
        writable: true
      },
      _isSwitchedOff: {
        value: false,
        writable: true
      },
    });
    this.setSid(sid);
  }

  /**
   * Non-null if subscription failed.
   * @property {?Error}
   */
  get error() {
    return this._error;
  }

  /**
   * true if track is switched off by the VMS server.
   * @property {boolean}
   */
  get isSwitchedOff() {
    return this._isSwitchedOff;
  }

  /**
   * Whether the {@link RemoteTrackPublicationSignaling} is subscribed to.
   * @property {boolean}
   */
  get isSubscribed() {
    return !!this.trackTransceiver;
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
   * Updates track switch on/off state.
   * @param {boolean} isSwitchedOff
   * @returns {this}
   */
  setSwitchedOff(isSwitchedOff) {
    if (this._isSwitchedOff !== isSwitchedOff) {
      this._isSwitchedOff = isSwitchedOff;
      this.emit('trackSwitchedOff', isSwitchedOff);
    }
    return this;
  }
}

 /**
 * Emitted whenever track is switched off or on
 * @param {boolean} switchOff - true track was switched off. false if it was switched on.
 * @event RemoteTrackPublicationSignaling#trackSwitchedOff
 */


module.exports = RemoteTrackPublicationSignaling;
