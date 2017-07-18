'use strict';

var buildLogLevels = require('../../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');

/**
 * Construct a {@link RemoteTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link RemoteTrack} represents a media {@link Track} published
 * to the {@link Room} by a {@link RemoteParticipant}.
 * @param {function(MediaStreamTrack, TrackSignaling): Track} Track
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {RemoteTrackSignaling} signaling
 * @param {{log: Log}} options
 * @property {boolean} isSubscribed - Whether the {@link RemoteTrack} is
 *    subscribed by the {@link LocalParticipant}
 * @property {Track.SID} sid - The SID assigned to the {@link RemoteTrack}
 * @fires RemoteTrack#unsubscribed
 */
function RemoteTrack(Track, mediaStreamTrack, signaling, options) {
  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);
  Track.call(this, mediaStreamTrack, options);

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
    isEnabled: {
      enumerable: true,
      get: function() {
        return signaling.isEnabled;
      }
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
  this._signaling.on('updated', function onupdated() {
    self.emit(self.isEnabled ? 'enabled' : 'disabled', self);
  });
}

RemoteTrack.prototype.toString = function toString() {
  return '[RemoteTrack #' + this._instanceId + ': ' + this.sid + ']';
};

RemoteTrack.prototype._unsubscribe = function unsubscribe() {
  if (this.isSubscribed) {
    this._isSubscribed = false;
    this.emit('unsubscribed', this);
  }
  return this;
};

/**
 * A {@link RemoteTrack} was unsubscribed from.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was unsubscribed from
 * @event RemoteTrack#unsubscribed
 */

module.exports = RemoteTrack;
