'use strict';

var buildLogLevels = require('../../util').buildLogLevels;
var Log = require('../../util/log');
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var MediaTrack = require('./mediatrack');
var MediaTrackSender = require('./sender');

/**
 * Construct a {@link LocalMediaTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalMediaTrack} represents audio or video that your
 * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
 * enabled and disabled with {@link LocalMediaTrack#enable} and
 * {@link LocalMediaTrack#disable} or stopped completely with
 * {@link LocalMediaTrack#stop}.
 * @extends MediaTrack
 * @param {function(MediaTrackTransceiver, TrackSignaling): MediaTrack} - MediaTrack
 * @param {MediaStream} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 * @property {boolean} isStopped - Whether or not the {@link LocalMediaTrack} is stopped
 * @fires LocalMediaTrack#stopped
 */
function LocalMediaTrack(MediaTrack, mediaStreamTrack, options) {
  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);

  var mediaTrackSender = new MediaTrackSender(mediaStreamTrack);
  MediaTrack.call(this, mediaTrackSender, options);

  Object.defineProperties(this, {
    _didCallEnd: {
      value: false,
      writable: true
    },
    _trackSender: {
      value: mediaTrackSender
    },
    isEnabled: {
      enumerable: true,
      get: function() {
        return this.mediaStreamTrack.enabled;
      }
    },
    isStopped: {
      get: function() {
        return this.mediaStreamTrack.readyState === 'ended';
      }
    }
  });
}

LocalMediaTrack.prototype._end = function _end() {
  if (this._didCallEnd) {
    return;
  }
  MediaTrack.prototype._end.call(this);
  this._didCallEnd = true;
  this.emit('stopped', this);
};

LocalMediaTrack.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  if (enabled !== this.mediaStreamTrack.enabled) {
    this._log.info((enabled ? 'En' : 'Dis') + 'abling');
    this.mediaStreamTrack.enabled = enabled;
    this.emit(enabled ? 'enabled' : 'disabled', this);
  }
  return this;
};

LocalMediaTrack.prototype.disable = function disable() {
  return this.enable(false);
};

LocalMediaTrack.prototype.stop = function stop() {
  this._log.info('Stopping');
  this.mediaStreamTrack.stop();
  this._end();
  return this;
};

module.exports = LocalMediaTrack;
