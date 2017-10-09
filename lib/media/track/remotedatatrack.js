'use strict';

var inherits = require('util').inherits;
var buildLogLevels = require('../../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');
var Track = require('./');

/**
 * Construct a {@link RemoteDataTrack} from a {@link DataTrackReceiver}.
 * @class
 * @classdesc A {@link RemoteDataTrack} represents data published to a
 *   {@link Room} by a {@link RemoteParticipant}.
 * @extends {Track}
 * @param {DataTrackReceiver} dataTrackReceiver
 * @param {RemoteTrackSignaling} signaling
 * @param {{log: Log}} options
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
 * @fires RemoteDataTrack#message
 * @fires RemoteDataTrack#unsubscribed
 */
function RemoteDataTrack(dataTrackReceiver, signaling, options) {
  if (!(this instanceof RemoteDataTrack)) {
    return new RemoteDataTrack(dataTrackReceiver, signaling, options);
  }

  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL,
    name: signaling.name
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);
  Track.call(this, dataTrackReceiver.id, 'data', options);

  var isSubscribed = signaling.isSubscribed;
  Object.defineProperties(this, {
    _isSubscribed: {
      set: function(_isSubscribed) {
        isSubscribed = _isSubscribed;
      },
      get: function() {
        return isSubscribed;
      }
    },
    _signaling: {
      value: signaling
    },
    isSubscribed: {
      enumerable: true,
      get: function() {
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

  var self = this;
  dataTrackReceiver.on('message', function(data) {
    self.emit('message', data, self);
  });
}

inherits(RemoteDataTrack, Track);

RemoteDataTrack.prototype._unsubscribe = function unsubscribe() {
  if (this.isSubscribed) {
    this._isSubscribed = false;
    this.emit('unsubscribed', this);
  }
  return this;
};

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
