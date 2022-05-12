'use strict';

const RemoteTrackPublicationSignaling = require('../remotetrackpublication');

/**
 * @extends RemoteTrackPublicationSignaling
 */
class RemoteTrackPublicationV3 extends RemoteTrackPublicationSignaling {
  /**
   * Construct a {@link RemoteTrackPublicationV3}.
   * @param {RemoteTrackPublicationV3#Representation} track
   * @param {boolean} isSwitchedOff
   * @param {?string} switchOffReason
   */
  constructor(track, isSwitchedOff, switchOffReason = null) {
    switchOffReason = isSwitchedOff ? switchOffReason : null;
    const enabled = isEnabled(isSwitchedOff, switchOffReason);
    const { kind, name, priority, sid } = track;

    super(
      sid,
      name,
      kind,
      enabled,
      priority,
      isSwitchedOff,
      3
    );

    Object.defineProperties(this, {
      _isSubscribed: {
        value: false,
        writable: true
      },
      _switchOffReason: {
        value: switchOffReason,
        writable: true
      }
    });
  }

  /**
   * Whether the {@link RemoteTrackPublicationV3} is subscribed to.
   * @property {boolean}
   */
  get isSubscribed() {
    return this._isSubscribed;
  }

  /**
   * The reason for the {@link RemoteTrackPublicationV3} being switched off.
   * @returns {?string}
   */
  get switchOffReason() {
    return this._switchOffReason;
  }

  /**
   * Updates track switch on/off state.
   * @param {boolean} isSwitchedOff
   * @param {?string} switchOffReason
   * @returns {this}
   */
  setSwitchedOff(isSwitchedOff, switchOffReason) {
    switchOffReason = isSwitchedOff ? switchOffReason : null;
    const shouldEmitUpdated = isSwitchedOff !== this.isSwitchedOff
      || switchOffReason !== this.switchOffReason;
    this._isSwitchedOff = isSwitchedOff;
    this._switchOffReason = switchOffReason;
    if (shouldEmitUpdated) {
      this.emit('updated');
    }
    return this.enable(isEnabled(isSwitchedOff, switchOffReason));
  }

  /**
   * Set the {@link MediaTrackReceiver} on the {@link RemoteTrackPublicationV3}.
   * @override
   * @param {MediaTrackReceiver} trackReceiver
   * @param {boolean} isSubscribed
   * @returns {this}
   */
  setTrackTransceiver(trackReceiver, isSubscribed) {
    isSubscribed = !!trackReceiver || isSubscribed;
    const shouldEmitUpdated = trackReceiver !== this.trackTransceiver || isSubscribed !== this.isSubscribed;
    this._trackTransceiver = trackReceiver;
    this._isSubscribed = isSubscribed;
    if (shouldEmitUpdated) {
      this.emit('updated');
    }
    return this;
  }

  /**
   * Compare the {@link RemoteTrackPublicationV3} to a
   * {@link RemoteTrackPublicationV3#Representation} of itself and perform any
   * updates necessary.
   * @param {RemoteTrackPublicationV3#Representation} track
   * @returns {this}
   * @fires TrackSignaling#updated
   */
  update(track) {
    this.setPriority(track.priority);
    return this;
  }
}

/**
 * @private
 * @param {boolean} isSwitchedOff
 * @param {?string} switchOffReason
 * @returns {boolean}
 */
function isEnabled(isSwitchedOff, switchOffReason) {
  return !(isSwitchedOff && switchOffReason === 'DISABLED_BY_PUBLISHER');
}

/**
 * The Room Signaling Protocol (RSP) representation of a {@link RemoteTrackPublicationV3}.
 * @typedef {object} RemoteTrackPublicationV3#Representation
 * @property {Track.Kind} kind
 * @property {string} name
 * @priority {Track.Priority} priority
 * @property {Track.SID} sid
 */

module.exports = RemoteTrackPublicationV3;
