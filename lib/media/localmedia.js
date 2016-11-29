'use strict';

var getUserMedia = require('../webrtc/getusermedia');
var inherits = require('util').inherits;
var constants = require('../util/constants');
var util = require('../util');
var LocalAudioTrack = require('./track/localaudiotrack');
var LocalVideoTrack = require('./track/localvideotrack');
var Media = require('./');
var Log = require('../util/log');

/**
 * Construct a {@link LocalMedia} object.
 * @class
 * @classdesc A {@link LocalMedia} object is a {@link Media} object representing
 *   {@link LocalAudioTrack}s and {@link LocalVideoTrack}s that your {@link Client} may
 *   share in a {@link Room}.
 * @extends Media
 * @params {LocalMedia.Options} [options] - The {@link LocalMedia} options.
 * @property {Map<Track.ID, LocalAudioTrack>} audioTracks - The {@link LocalAudioTrack}s on
 *   this {@link Media} object
 * @property {Map<Track.ID, LocalTrack>} tracks - The {@link LocalAudioTrack}s and
 *   {@link LocalVideoTrack}s on this {@link Media} object
 * @property {Map<Track.ID, LocalVideoTrack>} videoTracks - The {@link LocalVideoTrack}s on
 *   this {@link Media} object
 */
function LocalMedia(options) {
  if (!(this instanceof LocalMedia)) {
    return new LocalMedia(options);
  }

  options = Object.assign({
    logLevel: constants.DEFAULT_LOG_LEVEL
  }, options);
  options.log = options.log || new Log('media', this, util.buildLogLevels(options.logLevel));

  Media.call(this, options);

  return this;
}

/**
 * Get {@link LocalMedia}. By default, this requests a
 * {@link LocalAudioTrack} and a {@link LocalVideoTrack} representing a microphone and
 * camera.
 * <br><br>
 * This method calls <code>getUserMedia</code> internally. Pass in
 * <code>options</code> to override the default behavior.
 * @param {?LocalMedia.GetLocalMediaOptions}
 *   [options={audio:true,video:true}] - Options to override
 *   {@link LocalMedia.getLocalMedia}'s default behavior
 * @returns {Promise<LocalMedia>}
 */
LocalMedia.getLocalMedia = function getLocalMedia(options) {
  options = options || {};
  if (options.localMedia) {
    return Promise.resolve(options.localMedia);
  }
  var localMedia = new LocalMedia(options);
  var log = localMedia._log;

  if (options.localStream) {
    log.info('Adding user-provided local MediaStream');
    log.debug('MediaStream:', options.localStream);
    return Promise.resolve(localMedia.addStream(options.localStream));
  }
  // NOTE(mroberts): getUserMedia requires audio and/or video, so if
  // localStreamConstraints is set explicitly disabling both, just return an
  // empty LocalMedia object.
  if (options.audio === false &&
      options.video === false) {
    log.info('Neither audio nor video requested, so returning empty LocalMedia');
    return Promise.resolve(localMedia);
  }

  log.info('Calling getUserMedia:', options);

  return getUserMedia({
    audio: options.audio === null || typeof options.audio === 'undefined' ? true : options.audio,
    video: options.video === null || typeof options.video === 'undefined' ? true : options.video
  }).then(function(mediaStream) {
    log.info('Call to getUserMedia successful; got MediaStream:', mediaStream);
    log.info('Adding MediaStream to LocalMedia');
    return localMedia.addStream(mediaStream);
  }).catch(function(error) {
    log.warn('Call to getUserMedia failed:', error);
    throw error;
  });
};

inherits(LocalMedia, Media);

LocalMedia.prototype.toString = function toString() {
  return '[LocalMedia #' + this._instanceId + ']';
};

/**
 * Set log levels for {@link LocalMedia}
 * @param {LogLevels|LogLevel} logLevel - New log level(s)
 * @returns {LocalMedia} this
 */
LocalMedia.prototype.setLogLevel = function setLogLevel(logLevel) {
  this._log.setLevels(util.buildLogLevels(logLevel));
  return this;
};

/**
 * Adds a {@link LocalTrack} to the {@link LocalMedia} object, if not already added.
 * @method
 * @param {LocalTrack} track - The {@link LocalTrack} to add
 * @returns {this}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addTrack = function addTrack(track) {
  // LocalMedia's removeTrack method will remove the MediaStreamTrack
  // from the MediaStream; add it back here if it is missing.
  if (track.mediaStream.getTracks().indexOf(track.mediaStreamTrack) === -1) {
    this._log.debug('Adding MediaStreamTrack:', track.mediaStreamTrack);
    track.mediaStream.addTrack(track.mediaStreamTrack);
  }

  return Media.prototype._addTrack.apply(this, arguments);
};

/**
 * Adds a {@link LocalAudioTrack} representing your browser's microphone to the
 * {@link LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ audio: true })</code>.
 * @param {MediaTrackConstraints} [audioConstraints]
 * @returns {Promise<LocalAudioTrack>}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addMicrophone = function addMicrophone(audioConstraints) {
  var self = this;
  var microphone = null;
  var log = this._log;
  audioConstraints = audioConstraints || true;

  this.audioTracks.forEach(function(audioTrack) {
    microphone = microphone || audioTrack;
  });
  if (microphone) {
    log.info('Returning existing LocalAudioTrack for microphone:', microphone);
    return Promise.resolve(microphone);
  }

  log.info('Getting microphone');

  return getUserMedia({ audio: audioConstraints, video: false })
    .then(function gotMicrophone(mediaStream) {
      var audioTracks = mediaStream.getAudioTracks();
      var mediaStreamTrack = audioTracks[0];
      var audioTrack = new LocalAudioTrack(mediaStream, mediaStreamTrack, { log: log });
      self._addTrack(audioTrack);
      log.info('Got microphone:', mediaStreamTrack);
      return audioTrack;
    }).catch(function(error) {
      log.warn('Error while getting microphone:', error);
      throw error;
    });
};

/**
 * Removes the {@link LocalAudioTrack} representing your browser's microphone, if it
 * has been added.
 * @param {?boolean} [stop=true] - Whether or not to call
 *   {@link LocalTrack#stop} on the corresponding {@link LocalTrack}
 * @returns {?LocalAudioTrack}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeMicrophone = function removeMicrophone(stop) {
  var microphone = null;
  var log = this._log;

  this.audioTracks.forEach(function(audioTrack) {
    microphone = microphone || audioTrack;
  });

  if (microphone) {
    log.info((stop ? 'Stopping and r' : 'R') + 'emoving microphone:', microphone);
    return this.removeTrack(microphone, stop);
  }

  log.debug('Cannot remove the microphone because it has not been added');
  return microphone;
};

/**
 * Adds a {@link LocalVideoTrack} representing your browser's camera to the
 * {@link LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ video: true })</code>.
 * @param {MediaTrackConstraints} [videoConstraints]
 * @returns {Promise<LocalVideoTrack>}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addCamera = function addCamera(videoConstraints) {
  var self = this;
  var camera = null;
  var log = this._log;
  videoConstraints = videoConstraints || true;

  this.videoTracks.forEach(function(videoTrack) {
    camera = camera || videoTrack;
  });
  if (camera) {
    log.info('Returning existing LocalVideoTrack for camera:', camera);
    return Promise.resolve(camera);
  }
  return getUserMedia({ audio: false, video: videoConstraints })
    .then(function gotCamera(mediaStream) {
      var videoTracks = mediaStream.getVideoTracks();
      var mediaStreamTrack = videoTracks[0];
      var videoTrack = new LocalVideoTrack(mediaStream, mediaStreamTrack, { log: log });
      self._addTrack(videoTrack);
      log.info('Got camera:', mediaStreamTrack);
      return videoTrack;
    }).catch(function(error) {
      log.warn('Error while getting camera:', error);
      throw error;
    });
};

/**
 * Removes the {@link LocalVideoTrack} representing your browser's camera, if it
 * has been added.
 * @param {?boolean} [stop=true] - Whether or not to call
 *   {@link LocalTrack#stop} on the corresponding {@link LocalTrack}
 * @returns {?LocalVideoTrack}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeCamera = function removeCamera(stop) {
  var camera = null;
  var log = this._log;

  this.videoTracks.forEach(function(videoTrack) {
    camera = camera || videoTrack;
  });

  if (camera) {
    log.info((stop ? 'Stopping and r' : 'R') + 'emoving camera:', camera);
    return this.removeTrack(camera, stop);
  }

  log.debug('Cannot remove the camera because it has not been added');
  return camera;
};

/**
 * Add a <code>MediaStream</code> to the {@link LocalMedia} object, constructing
 * {@link LocalTrack}s as necessary for each <code>MediaStreamTrack</code> contained
 * within.
 * @param {MediaStream} mediaStream - The <code>MediaStream</code> to add
 * @returns {this}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addStream = function addStream(mediaStream) {
  var log = this._log;

  mediaStream.getAudioTracks().forEach(function(mediaStreamTrack) {
    var audioTrack = new LocalAudioTrack(mediaStream, mediaStreamTrack, { log: log });
    this._addTrack(audioTrack);
    log.debug('Added new LocalAudioTrack:', audioTrack);
  }, this);

  mediaStream.getVideoTracks().forEach(function(mediaStreamTrack) {
    var videoTrack = new LocalVideoTrack(mediaStream, mediaStreamTrack, { log: log });
    this._addTrack(videoTrack);
    log.debug('Added new LocalVideoTrack:', videoTrack);
  }, this);

  log.info('Added MediaStream:', mediaStream);
  return this;
};

/**
 * Remove a <code>MediaStream</code> from the {@link LocalMedia} object. This
 * will remove any {@link LocalTrack}s corresponding to
 * <code>MediaStreamTrack</code>s contained within the <code>MediaStream</code>.
 * @param {MediaStream} mediaStream - The <code>MediaStream</code> to remove
 * @param {?boolean} [stop=true] - Whether or not to call
 *   {@link LocalTrack#stop} on the corresponding {@link LocalTrack}s
 * @returns {this}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeStream = function removeStream(mediaStream, stop) {
  var log = this._log;

  log.info((stop ? 'Stopping and r' : 'R') + 'emoving all Tracks '
    + 'associated with local MediaStream:', mediaStream);
  mediaStream.getTracks().forEach(function(mediaStreamTrack) {
    var track = this.tracks.get(mediaStreamTrack.id);
    if (track) {
      log.debug((stop ? 'Stopping and r' : 'R') + 'emoving LocalTrack:', track);
      this.removeTrack(track, stop);
    }
  }, this);

  return this;
};

/**
 * Removes a {@link LocalTrack} from the {@link LocalMedia} object, if it was added.
 * @method
 * @param {LocalTrack} track - The {@link LocalTrack} to remove
 * @param {?boolean} [stop=true] - Whether or not to call
 *   {@link LocalTrack#stop}
 * @returns {this}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeTrack = function removeTrack(track, stop) {
  var log = this._log;

  try {
    track.mediaStream.removeTrack(track.mediaStreamTrack);
    log.info('Removed MediaStreamTrack:', track.mediaStreamTrack);
  } catch (error) {
    // Firefox doesn't support removeStream/removeTrack, so we can't yet truly
    // remove and renegotiate media.
    log.warn('Cannot remove MediaStreamTrack on Firefox:', error);
  }
  Media.prototype._removeTrack.call(this, track);
  // NOTE(mroberts): An ended Track will trigger a subsequent call to
  // removeTrack on the Media superclass, which will trigger a renegotiation
  // before we have actually updated the MediaStream. So keep this line _after_
  // we actually updated the MediaStream.
  if (typeof stop === 'boolean' ? stop : true) {
    track.stop();
    log.info('Stopped LocalTrack:', track);
  }
  return track;
};

/**
 * Disable every {@link LocalAudioTrack} on this {@link LocalMedia} object.
 * @returns {this}
 * @fires Media#trackDisabled
*//**
 * Disable or enable every {@link LocalAudioTrack} on this {@link LocalMedia} object.
 * @param {?boolean} enabled - Specify false to enable the {@link LocalAudioTrack}s
 * @returns {this}
 * @fires Media#trackDisabled
 * @fires Media#trackEnabled
 */
LocalMedia.prototype.mute = function mute(muted) {
  var log = this._log;

  log.info((muted ? 'M' : 'Unm') + 'uting LocalMedia by '
    + (muted ? 'dis' : 'en') + 'abling the LocalAudioTracks');

  muted = typeof muted === 'boolean' ? muted : true;
  this.audioTracks.forEach(function(track) {
    log.debug((muted ? 'Dis' : 'En') + 'abling LocalAudioTrack:', track);
    track.enable(!muted);
  });

  return this;
};

/**
 * Disable every {@link LocalVideoTrack} on this {@link LocalMedia} object.
 * @returns {this}
 * @fires Media#trackDisabled
*//**
 * Disable or enable every {@link LocalVideoTrack} on this {@link LocalMedia} object.
 * @param {?boolean} enabled - Specify false to enable the {@link LocalVideoTrack}s
 * @returns {this}
 * @fires Media#trackDisabled
 * @fires Media#trackEnabled
 */
LocalMedia.prototype.pause = function pause(paused) {
  var log = this._log;

  log.info((paused ? 'P' : 'Unp') + 'ausing LocalMedia by '
    + (paused ? 'dis' : 'en') + 'abling the LocalVideoTracks');

  paused = typeof paused === 'boolean' ? paused : true;
  this.videoTracks.forEach(function(track) {
    log.debug((paused ? 'Dis' : 'En') + 'abling LocalVideoTrack:', track);
    track.enable(!paused);
  });

  return this;
};

/**
 * Stop all {@link LocalAudioTrack}s and {@link LocalVideoTrack}s on this {@link LocalMedia} object.
 * @returns {this}
 */
LocalMedia.prototype.stop = function stop() {
  var log = this._log;

  log.info('Stopping the LocalMedia by stopping all LocalTracks');

  this.tracks.forEach(function(track) {
    log.debug('Stopping LocalTrack:', track);
    track.stop();
  });

  return this;
};

/**
 * Enable every {@link LocalAudioTrack} on this {@link LocalMedia} object.
 * @returns {this}
 * @fires Media#trackEnabled
 */
LocalMedia.prototype.unmute = function unmute() {
  return this.mute(false);
};

/**
 * Enable every {@link LocalVideoTrack} on this {@link LocalMedia} object.
 * @returns {this}
 * @fires Media#trackEnabled
 */
LocalMedia.prototype.unpause = function unpause() {
  return this.pause(false);
};

/**
 * You may pass these options to the {@link LocalMedia} constructor to
 * override the default behavior.
 * @typedef {object} LocalMedia.Options
 * @property {LogLevel|LogLevels} [logLevel='warn'] - Set the log verbosity
 *   of logging to console. Passing a {@link LogLevel} string will use the
 *   same level for all components. Pass a {@link LogLevels} to set specific
 *   log levels.
 */

/**
 * You may pass these options to {@link LocalMedia.getLocalMedia} to
 * override the default behavior.
 * @typedef {object} LocalMedia.GetLocalMediaOptions
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code>
 * @property {?boolean} [audio=true] - Whether or not to get local audio
 *   with <code>getUserMedia</code> when neither <code>localMedia</code>
 *   nor <code>localStream</code> are provided
 * @property {?boolean} [video=true] - Whether or not to get local video
 *   with <code>getUserMedia</code> when neither <code>localMedia</code>
 *   nor <code>localStream</code> are provided
 */

module.exports = LocalMedia;
