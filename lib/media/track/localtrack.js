'use strict';

var buildLogLevels = require('../../util').buildLogLevels;
var LocalTrackSignaling = require('../../signaling/localtrack');
var Log = require('../../util/log');
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Track = require('./');

/**
 * @class
 * @classdesc A {@link LocalTrack} represents audio or video that your
 * {@link Client} is sending to a {@link Room}. As such, it can be
 * enabled and disabled with {@link LocalTrack#enable} and
 * {@link LocalTrack#disable} or stopped completely with
 * {@link LocalTrack#stop}.
 * @extends Track
 * @param {function(MediaStreamTrack, TrackSignaling): Track} Track
 * @param {MediaStream} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {LocalTrackOptions} options
 * @property {boolean} isStopped - Whether or not the {@link LocalTrack} is stopped
 * @fires LocalTrack#stopped
 */
function LocalTrack(Track, mediaStreamTrack, options) {
  var signaling = new LocalTrackSignaling(mediaStreamTrack);

  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);
  Track.call(this, mediaStreamTrack, signaling, options);

  Object.defineProperties(this, {
    _didCallEnd: {
      value: false,
      writable: true
    },
    isStopped: {
      get: function() {
        return this.mediaStreamTrack.readyState === 'ended';
      }
    }
  });
}

LocalTrack.prototype._end = function _end() {
  if (this._didCallEnd) {
    return;
  }
  Track.prototype._end.call(this);
  this._didCallEnd = true;
  this.emit('stopped', this);
};

LocalTrack.prototype.toString = function toString() {
  return '[LocalTrack #' + this._instanceId + ': ' + this.id + ']';
};

/**
 * Enable the {@link LocalTrack}.
 * @returns {this}
 * @fires Track#enabled
*//**
 * Enable or disable the {@link LocalTrack}.
 * @param {boolean} [enabled] - Specify false to disable the {@link LocalTrack}
 * @returns {this}
 * @fires Track#disabled
 * @fires Track#enabled
 */
LocalTrack.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  this._log.info((enabled ? 'En' : 'Dis') + 'abling');
  this.mediaStreamTrack.enabled = enabled;
  this._signaling.enable(enabled);
  return this;
};

/**
 * Disable the {@link LocalTrack}.
 * @returns {this}
 * @fires Track#disabled
 */
LocalTrack.prototype.disable = function disable() {
  return this.enable(false);
};

/**
 * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
 * {@link LocalTrack}, you should use {@link LocalParticipant#removeTrack} to
 * remove it after stopping. You do not need to stop a track before using
 * {@link LocalTrack#disable} or {@link LocalParticipant#removeTrack}.
 * @returns {this}
 */
LocalTrack.prototype.stop = function stop() {
  this._log.info('Stopping');
  this.mediaStreamTrack.stop();
  this._end();
  return this;
};

/**
 * {@link LocalTrack} options
 * @typedef {object} LocalTrackOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

/**
 * The {@link LocalTrack} was stopped, either because {@link LocalTrack#stop}
 * was called or because the underlying MediaStreamTrack ended).
 * @param {LocalTrack} track - The {@link LocalTrack} that stopped
 * @event LocalTrack#stopped
 */

module.exports = LocalTrack;
