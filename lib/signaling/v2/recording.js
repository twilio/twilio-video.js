'use strict';

const RecordingSignaling = require('../recording');

/**
 * @extends RecordingSignaling
 */
class RecordingV2 extends RecordingSignaling {
  /**
   * Construct a {@link RecordingV2}.
   */
  constructor() {
    super();
    Object.defineProperties(this, {
      _revision: {
        value: 1,
        writable: true
      }
    });
  }

  /**
   * Compare the {@link RecordingV2} to a {@link RecordingV2#Representation}
   * of itself and perform any updates necessary.
   * @param {RecordingV2#Representation} recording
   * @returns {this}
   * @fires RecordingSignaling#updated
   */
  update(recording) {
    if (recording.revision < this._revision) {
      return this;
    }
    this._revision = recording.revision;
    return this.enable(recording.is_recording);
  }
}

/**
 * The Room Signaling Protocol (RSP) representation of a {@link RecordingV2}
 * @typedef {object} RecordingV2#Representation
 * @property {boolean} enabled
 * @property {number} revision
 */

module.exports = RecordingV2;
