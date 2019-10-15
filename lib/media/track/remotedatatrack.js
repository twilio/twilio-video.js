'use strict';

const Track = require('./');
const { typeErrors: E, trackPriority } = require('../../util/constants');

/**
 * A {@link RemoteDataTrack} represents data published to a {@link Room} by a
 * {@link RemoteParticipant}.
 * @extends Track
 * @property {boolean} isEnabled - true
 * @property {boolean} isSubscribed - Whether the {@link RemoteDataTrack} is
 *   subscribed to
 * @property {boolean} isSwitchedOff - Whether the {@link RemoteDataTrack} is
 *   switched off
 * @property {Track.Kind} kind - "data"
 * @property {?number} maxPacketLifeTime - If non-null, this represents a time
 *   limit (in milliseconds) during which data will be transmitted or
 *   retransmitted if not acknowledged on the underlying RTCDataChannel.
 * @property {?number} maxRetransmits - If non-null, this represents the number
 *   of times the data will be retransmitted if not successfully received on the
 *   underlying RTCDataChannel.
 * @property {boolean} ordered - true if data on the {@link RemoteDataTrack} can
 *   be received out-of-order.
 * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteDataTrack}
 * @property {boolean} reliable - This is true if both
 *   <code>maxPacketLifeTime</code> and <code>maxRetransmits</code> are set to
 *   null. In other words, if this is true, there is no bound on packet lifetime
 *   or the number of retransmits that will be attempted, ensuring "reliable"
 *   transmission.
 * @property {Track.SID} sid - The SID assigned to the {@link RemoteDataTrack}
 * @emits RemoteDataTrack#message
 * @emits RemoteDataTrack#switchedOff
 * @emits RemoteDataTrack#switchedOn
 */
class RemoteDataTrack extends Track {
  /**
   * Construct a {@link RemoteDataTrack} from a {@link DataTrackReceiver}.
   * @param {Track.SID} sid
   * @param {DataTrackReceiver} dataTrackReceiver
   * @param {{log: Log, name: ?string}} options
   */
  constructor(sid, dataTrackReceiver, options) {
    super(dataTrackReceiver.id, 'data', options);

    Object.defineProperties(this, {
      _isSwitchedOff: {
        value: false,
        writable: true
      },
      _priority: {
        value: null,
        writable: true
      },
      isEnabled: {
        enumerable: true,
        value: true
      },
      isSwitchedOff: {
        enumerable: true,
        get() {
          return this._isSwitchedOff;
        }
      },
      maxPacketLifeTime: {
        enumerable: true,
        value: dataTrackReceiver.maxPacketLifeTime
      },
      maxRetransmits: {
        enumerable: true,
        value: dataTrackReceiver.maxRetransmits
      },
      ordered: {
        enumerable: true,
        value: dataTrackReceiver.ordered
      },
      priority: {
        enumerable: true,
        get() {
          return this._priority;
        }
      },
      reliable: {
        enumerable: true,
        value: dataTrackReceiver.maxPacketLifeTime === null
          && dataTrackReceiver.maxRetransmits === null
      },
      sid: {
        enumerable: true,
        value: sid
      }
    });

    dataTrackReceiver.on('message', data => {
      this.emit('message', data, this);
    });
  }

  /**
   * Update the subscriber {@link Track.Priority} of the {@link RemoteDataTrack}.
   * @param {?Track.Priority} priority - the new {@link Track.priority};
   *   Currently setPriority has no effect on data tracks.
   * @returns {this}
   * @throws {RangeError}
   */
  setPriority(priority) {
    const priorityValues = [null, ...Object.values(trackPriority)];
    if (!priorityValues.includes(priority)) {
      // eslint-disable-next-line new-cap
      throw E.INVALID_VALUE('priority', priorityValues);
    }

    // Note: priority has no real effect on the data tracks.
    this._priority = priority;
    return this;
  }

  /**
   * @private
   */
  _setEnabled() {
    // Do nothing.
  }

  /**
   * @private
   * @param {boolean} isSwitchedOff
   */
  _setSwitchedOff(isSwitchedOff) {
    if (this._isSwitchedOff !== isSwitchedOff) {
      this._isSwitchedOff = isSwitchedOff;
      this.emit(isSwitchedOff ? 'switchedOff' : 'switchedOn', this);
    }
  }
}

/**
 * A message was received over the {@link RemoteDataTrack}.
 * @event RemoteDataTrack#message
 * @param {string|ArrayBuffer} data
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that received
 *   the message
 */

/**
 * A {@link RemoteDataTrack} was switched off.
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that was
 *   switched off
 * @event RemoteDataTrack#switchedOff
 */

/**
 * A {@link RemoteDataTrack} was switched on.
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that was
 *   switched on
 * @event RemoteDataTrack#switchedOn
 */

module.exports = RemoteDataTrack;
