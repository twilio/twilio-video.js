'use strict';

const MediaSignaling = require('./mediasignaling');

/**
 * @property {?Track.SID} loudestParticipantSid
 * @emits DominantSpeakerSignaling#updated
 */
class DominantSpeakerSignaling extends MediaSignaling {
  /**
   * Construct an {@link DominantSpeakerSignaling}.
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'active_speaker', options);

    Object.defineProperties(this, {
      _loudestParticipantSid: {
        value: null,
        writable: true
      },
    });

    this.on('ready', transport => {
      transport.on('message', message => {
        switch (message.type) {
          case 'active_speaker':
            this._setLoudestParticipantSid(message.participant);
            break;
          default:
            break;
        }
      });
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
 * @event DominantSpeakerSignaling#updated
 */

module.exports = DominantSpeakerSignaling;
