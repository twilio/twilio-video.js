'use strict';

const Track = require('./');

/**
 * A {@link RemoteDataTrack} represents data published to a {@link Room} by a
 * {@link RemoteParticipant}.
 * @extends Track
 * @property {boolean} isSubscribed - Whether the {@link RemoteDataTrack} is
 *   currently subscribed to
 * @property {Track.Kind} kind - "data"
 * @property {?number} maxPacketLifeTime - If non-null, this represents a time
 *   limit (in milliseconds) during which data will be transmitted or
 *   retransmitted if not acknowledged on the underlying RTCDataChannel.
 * @property {?number} maxRetransmits - If non-null, this represents the number
 *   of times the data will be retransmitted if not successfully received on the
 *   underlying RTCDataChannel.
 * @property {boolean} ordered - true if data on the {@link RemoteDataTrack} can
 *   be received out-of-order.
 * @property {boolean} reliable - This is true if both
 *   <code>maxPacketLifeTime</code> and <code>maxRetransmits</code> are set to
 *   null. In other words, if this is true, there is no bound on packet lifetime
 *   or the number of retransmits that will be attempted, ensuring "reliable"
 *   transmission.
 * @property {Track.SID} sid - The {@link RemoteDataTrack}'s SID
 * @emits RemoteDataTrack#message
 * @emits RemoteDataTrack#unsubscribed
 */
class RemoteDataTrack extends Track {
  /**
   * Construct a {@link RemoteDataTrack} from a {@link DataTrackReceiver}.
   * @param {DataTrackReceiver} dataTrackReceiver
   * @param {RemoteTrackSignaling} signaling
   * @param {{log: Log}} options
   */
  constructor(dataTrackReceiver, signaling, options) {
    options = Object.assign({
      name: signaling.name
    }, options);

    super(dataTrackReceiver.id, 'data', options);

    let isSubscribed = signaling.isSubscribed;
    Object.defineProperties(this, {
      _isSubscribed: {
        set(_isSubscribed) {
          isSubscribed = _isSubscribed;
        },
        get() {
          return isSubscribed;
        }
      },
      _signaling: {
        value: signaling
      },
      isSubscribed: {
        enumerable: true,
        get() {
          return this._isSubscribed;
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
      reliable: {
        enumerable: true,
        value: dataTrackReceiver.maxPacketLifeTime === null
          && dataTrackReceiver.maxRetransmits === null
      },
      sid: {
        enumerable: true,
        value: signaling.sid
      }
    });

    dataTrackReceiver.on('message', data => {
      this.emit('message', data, this);
    });
  }

  /**
   * @private
   */
  _unsubscribe() {
    if (this.isSubscribed) {
      this._isSubscribed = false;
      this.emit('unsubscribed', this);
    }
    return this;
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
 * The {@link RemoteDataTrack} was unsubscribed from.
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that was
 *   unsubscribed from
 * @event RemoteDataTrack#unsubscribed
 */

module.exports = RemoteDataTrack;
