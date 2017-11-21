'use strict';

var buildLogLevels = require('../../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');

/**
 * Construct a {@link RemoteMediaTrack}.
 * @class
 * @classdesc A {@link RemoteMediaTrack} represents a {@link MediaTrack}
 *   published to a {@link Room} by a {@link RemoteParticipant}.
 * @extends {MediaTrack}
 * @param {function(MediaTrackTransceiver, TrackSignaling): MediaTrack} MediaTrack
 * @param {MediaTrackReceiver} mediaTrackReceiver
 * @param {RemoteTrackSignaling} signaling
 * @param {{log: Log}} options
 * @property {boolean} isSubscribed - Whether the {@link RemoteMediaTrack} is
 *   subscribed by the {@link LocalParticipant}
 * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
 * @fires RemoteTrack#unsubscribed
 */
function RemoteMediaTrack(MediaTrack, mediaTrackReceiver, signaling, options) {
  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL,
    name: signaling.name
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);
  MediaTrack.call(this, mediaTrackReceiver, options);

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
    _mediaTrackReceiver: {
      value: mediaTrackReceiver
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

RemoteMediaTrack.prototype._unsubscribe = function unsubscribe() {
  if (this.isSubscribed) {
    this._isSubscribed = false;
    this.emit('unsubscribed', this);
  }
  return this;
};

module.exports = RemoteMediaTrack;
