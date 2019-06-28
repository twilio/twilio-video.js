'use strict';

const { EventEmitter } = require('events');

/**
 * @property {?Track.SID} loudestParticipantSid
 * @emits TrackSwitchOffSignalinging#updated
 */
class TrackSwitchOffSignaling extends EventEmitter {
  /**
   * Construct a {@link TrackSwitchOffSignaling}.
   * @param {MediaSignalingTransport} mediaSignalingTransport
   */
  constructor(mediaSignalingTransport) {
    super();

    Object.defineProperties(this, {
      _loudestParticipantSid: {
        value: null,
        writable: true
      },
    });

    mediaSignalingTransport.on('message', message => {
      switch (message.type) {
<<<<<<< HEAD
        case 'track_switch_off':
          this._setLoudestParticipantSid(message.off || [], message.on || []);
=======
        case 'active_speaker':
          this._setLoudestParticipantSid(message.participant);
>>>>>>> 5b3bcea3ffeebeb3a71b8bfd20d18d6290629cee
          break;
        default:
          break;
      }
    });
  }

  /**
   * Get the loudest {@link Track.SID}, if known.
   * @returns {?Track.SID}
   */
  get loudestParticipantSid() {
    return this._loudestParticipantSid;
  }

  /**
   * @private
<<<<<<< HEAD
<<<<<<< Updated upstream
=======
>>>>>>> 5b3bcea3ffeebeb3a71b8bfd20d18d6290629cee
   * @param {Track.SID} loudestParticipantSid
   * @returns {void}
   */
  _setLoudestParticipantSid(loudestParticipantSid) {
    if (this.loudestParticipantSid === loudestParticipantSid) {
      return;
    }
    this._loudestParticipantSid = loudestParticipantSid;
    this.emit('updated');
<<<<<<< HEAD
=======
   * @param {[Track.SID]} tracksSwitchedOff
   * @param {[Track.SID]} tracksSwitchedOn
   * @returns {void}
   */
  _setTrackSwitchOffUpdates(tracksSwitchedOff, tracksSwitchedOn) {

    this.emit('updated', tracksSwitchedOff, tracksSwitchedOn);
>>>>>>> Stashed changes
=======
>>>>>>> 5b3bcea3ffeebeb3a71b8bfd20d18d6290629cee
  }
}

/**
 * @event TrackSwitchOffSignaling#updated
 */

module.exports = TrackSwitchOffSignaling;
