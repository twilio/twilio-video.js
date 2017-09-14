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
 * @property {Track.SID} sid - The {@link RemoteDataTrack}'s SID
 * @fires RemoteDataTrack#message
 * @fires RemoteDataTrack#unsubscribed
 */
function RemoteDataTrack(dataTrackReceiver, signaling, options) {
  if (!(this instanceof RemoteDataTrack)) {
    return new RemoteDataTrack(dataTrackReceiver, signaling, options);
  }

  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL
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
