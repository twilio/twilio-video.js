'use strict';

var inherits = require('util').inherits;
var buildLogLevels = require('../../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');
var Track = require('./');

/**
 * Construct a {@link RemoteDataTrack} from a {@link RemoteDataStreamTrack}.
 * @class
 * @classdesc A {@link RemoteDataTrack} represents a {@link DataTrack} published
 *   to the {@link Room} by a {@link RemoteParticipant}.
 * @extends {Track}
 * @param {RemoteDataStreamTrack} dataStreamTrack
 * @param {RemoteTrackSignaling} signaling
 * @param {{log: Log}} options
 * @property {boolean} isSubscried - Whether the {@link RemoteDataTrack} is
 *   subscribed by the {@link LocalParticipant}
 * @property {Track.SID} sid - The SID assigned to the {@link RemoteDataTrack}
 * @fires RemoteDataTrack#message
 * @fires RemoteTrack#unsubscribed
 */
function RemoteDataTrack(dataStreamTrack, signaling, options) {
  if (!(this instanceof RemoteDataTrack)) {
    return new RemoteDataTrack(dataStreamTrack, signaling, options);
  }

  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);
  Track.call(this, dataStreamTrack.id, 'data', options);

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

  dataStreamTrack.on('message', this.emit.bind(this, 'message'));
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
 */

module.exports = RemoteDataTrack;
