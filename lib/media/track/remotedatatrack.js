'use strict';

const { deprecateEvents } = require( '../../util');
const Track = require('./');

/**
 * A {@link RemoteDataTrack} represents data published to a {@link Room} by a
 * {@link RemoteParticipant}.
 * @extends Track
 * @property {boolean} isEnabled - true
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
 * @emits RemoteDataTrack#message
 * @emits RemoteDataTrack#unsubscribed
 */
class RemoteDataTrack extends Track {
  /**
   * Construct a {@link RemoteDataTrack} from a {@link DataTrackReceiver}.
   * @param {DataTrackReceiver} dataTrackReceiver
   * @param {{log: Log, name: ?string}} options
   */
  constructor(dataTrackReceiver, options) {
    super(dataTrackReceiver.id, 'data', options);

    Object.defineProperties(this, {
      _isSubscribed: {
        value: true,
        writable: true
      },
      _sid: {
        value: null,
        writable: true
      },
      isEnabled: {
        enumerable: true,
        value: true
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
      }
    });

    deprecateEvents('RemoteDataTrack', this, new Map([
      ['unsubscribed', null]
    ]), this._log);

    dataTrackReceiver.on('message', data => {
      this.emit('message', data, this);
    });
  }

  /**
   * The {@link RemoteDataTrack}'s ID.
   * @property {Track.ID}
   * @deprecated Use the parent {@link RemoteTrackPublication}'s .trackName
   *   or .trackSid instead
   */
  get id() {
    this._log.deprecated('RemoteDataTrack#id has been deprecated and is '
      + 'scheduled for removal in twilio-video.js@2.0.0. Use the parent '
      + 'RemoteTrackPublication\'s .trackName or .trackSid instead.');
    return this._id;
  }

  /**
   * Whether the {@link RemoteDataTrack} is subscribed to
   * @property {boolean}
   * @deprecated Use the parent {@link RemoteTrackPublication}'s .isSubscribed
   *   instead
   */
  get isSubscribed() {
    this._log.deprecated('RemoteDataTrack#isSubscribed has been deprecated and is '
      + 'scheduled for removal in twilio-video.js@2.0.0. Use the '
      + 'parent RemoteTrackPublication\'s .isSubscribed instead.');
    return this._isSubscribed;
  }

  /**
   * The SID assigned to the {@link RemoteMediaTrack}
   * @property {Track.SID}
   */
  get sid() {
    return this._sid;
  }

  /**
   * @private
   */
  _setEnabled() {
    // Do nothing.
  }

  /**
   * @private
   * @param {Track.SID} sid
   */
  _setSid(sid) {
    if (!this._sid) {
      this._sid = sid;
    }
  }

  /**
   * @private
   */
  _unsubscribe() {
    if (this._isSubscribed) {
      this._isSubscribed = false;
      this.emit('unsubscribed', this);
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
 * The {@link RemoteDataTrack} was unsubscribed from.
 * @event RemoteDataTrack#unsubscribed
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that was
 *   unsubscribed from
 * @deprecated Use the parent {@link RemoteTrackPublication}'s "unsubscribed"
 *   event instead
 */

module.exports = RemoteDataTrack;
