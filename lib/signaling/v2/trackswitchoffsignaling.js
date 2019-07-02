'use strict';

const { EventEmitter } = require('events');

/**
 * @emits TrackSwitchOffSignalinging#updated
 */
class TrackSwitchOffSignaling extends EventEmitter {
  /**
   * Construct a {@link TrackSwitchOffSignaling}.
   * @param {MediaSignalingTransport} mediaSignalingTransport
   */
  constructor(mediaSignalingTransport) {
    super();
    mediaSignalingTransport.on('message', message => {
      switch (message.type) {
        case 'track_switch_off':
          this._setTrackSwitchOffUpdates(message.off || [], message.on || []);
          break;
        default:
          break;
      }
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
