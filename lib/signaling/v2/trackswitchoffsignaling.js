'use strict';

const MediaSignaling = require('./mediasignaling');

/**
 * @emits TrackSwitchOffSignalinging#updated
 */
class TrackSwitchOffSignaling extends MediaSignaling {
  /**
   * Construct a {@link TrackSwitchOffSignaling}.
   * @param {Promise<DataTrackReceiver>} getReceiver
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'track_switch_off', options);
    this.on('ready', transport => {
      transport.on('message', message => {
        switch (message.type) {
          case 'track_switch_off':
            this._setTrackSwitchOffUpdates(message.off || [], message.on || []);
            break;
          default:
            break;
        }
      });
    });
  }

  /**
   * @private
   * @param {[Track.SID]} tracksSwitchedOff
   * @param {[Track.SID]} tracksSwitchedOn
   * @returns {void}
   */
  _setTrackSwitchOffUpdates(tracksSwitchedOff, tracksSwitchedOn) {
    this.emit('updated', tracksSwitchedOff, tracksSwitchedOn);
  }
}

/**
 * @event TrackSwitchOffSignaling#updated
 */

module.exports = TrackSwitchOffSignaling;
