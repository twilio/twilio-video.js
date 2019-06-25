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
        case 'active_speaker':
          this._setLoudestParticipantSid(message.participant);
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
   * @param {Track.SID} loudestParticipantSid
   * @returns {void}
   */
  _setLoudestParticipantSid(loudestParticipantSid) {
    if (this.loudestParticipantSid === loudestParticipantSid) {
      return;
    }
    this._loudestParticipantSid = loudestParticipantSid;
    this.emit('updated');
  }
}

/**
 * @event TrackSwitchOffSignaling#updated
 */

module.exports = TrackSwitchOffSignaling;
