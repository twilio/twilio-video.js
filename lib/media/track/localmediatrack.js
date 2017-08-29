'use strict';

var buildLogLevels = require('../../util').buildLogLevels;
var Log = require('../../util/log');
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var MediaTrack = require('./mediatrack');

/**
 * Construct a {@link LocalMediaTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalMediaTrack} represents audio or video that your
 * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
 * enabled and disabled with {@link LocalMediaTrack#enable} and
 * {@link LocalMediaTrack#disable} or stopped completely with
 * {@link LocalMediaTrack#stop}.
 * @extends MediaTrack
 * @param {function(MediaStreamTrack, TrackSignaling): MediaTrack} - Track
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
  MediaTrack.call(this, mediaStreamTrack, options);

  Object.defineProperties(this, {
    _didCallEnd: {
      value: false,
      writable: true
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

/**
 * Enable the {@link LocalMediaTrack}.
 * @returns {this}
 * @fires MediaTrack#enabled
*//**
 * Enable or disable the {@link LocalMediaTrack}.
 * @param {boolean} [enabled] - Specify false to disable the {@link LocalMediaTrack}
 * @returns {this}
 * @fires MediaTrack#disabled
 * @fires MediaTrack#enabled
 */
LocalMediaTrack.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  if (enabled !== this.mediaStreamTrack.enabled) {
    this._log.info((enabled ? 'En' : 'Dis') + 'abling');
    this.mediaStreamTrack.enabled = enabled;
    this.emit(enabled ? 'enabled' : 'disabled');
  }
  return this;
};

/**
 * Disable the {@link LocalMediaTrack}.
 * @returns {this}
 * @fires MediaTrack#disabled
 */
LocalMediaTrack.prototype.disable = function disable() {
  return this.enable(false);
};

/**
 * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
 * {@link LocalMediaTrack}, you should use {@link LocalParticipant#removeTrack} to
 * remove it after stopping. You do not need to stop a track before using
 * {@link LocalMediaTrack#disable} or {@link LocalParticipant#removeTrack}.
 * @returns {this}
 */
LocalMediaTrack.prototype.stop = function stop() {
  this._log.info('Stopping');
  this.mediaStreamTrack.stop();
  this._end();
  return this;
};

/**
 * The {@link LocalMediaTrack} was stopped, either because
 * {@link LocalMediaTrack#stop} was called or because the underlying
 * MediaStreamTrack ended).
 * @param {LocalMediaTrack} track - The {@link LocalMediaTrack} that stopped
 * @event LocalMediaTrack#stopped
 */

module.exports = LocalMediaTrack;
