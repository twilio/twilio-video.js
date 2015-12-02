'use strict';

var getUserMedia = require('../webrtc/getusermedia');
var inherits = require('util').inherits;
var LocalAudioTrack = require('./track/localaudiotrack');
var LocalVideoTrack = require('./track/localvideotrack');
var Media = require('./');

/**
 * Construct a {@link LocalMedia} object.
 * @class
 * @classdesc A {@link LocalMedia} object is a {@link Media} object representing
 *   {@link LocalAudioTrack}s and {@link LocalVideoTrack}s that your {@link Client} may
 *   share in a {@link Conversation}.
 * @extends Media
 * @property {Map<Track.ID, LocalAudioTrack>} audioTracks - The {@link LocalAudioTrack}s on
 *   this {@link Media} object
 * @property {Map<Track.ID, LocalTrack>} tracks - The {@link LocalAudioTrack}s and
 *   {@link LocalVideoTrack}s on this {@link Media} object
 * @property {Map<Track.ID, LocalVideoTrack>} videoTracks - The {@link LocalVideoTrack}s on
 *   this {@link Media} object
 */
function LocalMedia() {
  if (!(this instanceof LocalMedia)) {
    return new LocalMedia();
  }
  Media.call(this);
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
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link LocalMedia.getLocalMedia}'s default behavior
 * @returns {Promise<LocalMedia>}
 */
LocalMedia.getLocalMedia = function getLocalMedia(options) {
  options = options || {};
  if (options.localMedia) {
    return Promise.resolve(options.localMedia);
  }
  var localMedia = new LocalMedia();
  if (options.localStream) {
    return localMedia.addStream(options.localStream);
  }
  return getUserMedia(options.localStreamConstraints)
    .then(function(mediaStream) {
      return localMedia.addStream(mediaStream);
    });
};

inherits(LocalMedia, Media);

/**
 * Adds a {@link LocalTrack} to the {@link LocalMedia} object, if not already added.
 * @method
 * @param {LocalTrack} track - The {@link LocalTrack} to add
 * @returns {this}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addTrack = Media.prototype._addTrack;

/**
 * Removes a {@link LocalTrack} from the {@link LocalMedia} object, if it was added.
 * @method
 * @param {LocalTrack} track - The {@link LocalTrack} to remove
 * @returns {this}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeTrack = Media.prototype._removeTrack;

/**
 * Adds a {@link LocalAudioTrack} representing your browser's microphone to the
 * {@link LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ audio: true })</code>.
 * @returns {Promise<LocalAudioTrack>}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addMicrophone = function addMicrophone() {
  var self = this;
  var microphone = null;
  this.audioTracks.forEach(function(audioTrack) {
    microphone = microphone || audioTrack;
  });
  if (microphone) {
    return Promise.resolve(microphone);
  }
  return getUserMedia({ audio: true, video: false })
    .then(function gotMicrophone(mediaStream) {
      var audioTracks = mediaStream.getAudioTracks();
      var mediaStreamTrack = audioTracks[0];
      var audioTrack = new LocalAudioTrack(mediaStream, mediaStreamTrack);
      self._addTrack(audioTrack);
      return audioTrack;
    });
};

/**
 * Removes the {@link LocalAudioTrack} representing your browser's microphone, if it
 * has been added.
 * @returns {?LocalAudioTrack}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeMicrophone = function removeMicrophone() {
  var microphone = null;
  this.audioTracks.forEach(function(audioTrack) {
    microphone = microphone || audioTrack;
  });
  if (microphone) {
    return this._removeTrack(microphone);
  }
  return null;
};

/**
 * Adds a {@link LocalVideoTrack} representing your browser's camera to the
 * {@link LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ video: true })</code>.
 * @returns {Promise<LocalVideoTrack>}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addCamera = function addCamera() {
  var self = this;
  var camera = null;
  this.videoTracks.forEach(function(videoTrack) {
    camera = camera || videoTrack;
  });
  if (camera) {
    return Promise.resolve(camera);
  }
  return getUserMedia({ audio: false, video: true })
    .then(function gotCamera(mediaStream) {
      var videoTracks = mediaStream.getVideoTracks();
      var mediaStreamTrack = videoTracks[0];
      var videoTrack = new LocalVideoTrack(mediaStream, mediaStreamTrack);
      self._addTrack(videoTrack);
      return videoTrack;
    });
};

/**
 * Removes the {@link LocalVideoTrack} representing your browser's camera, if it
 * has been added.
 * @returns {?LocalVideoTrack}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeCamera = function removeCamera() {
  var camera = null;
  this.videoTracks.forEach(function(videoTrack) {
    camera = camera || videoTrack;
  });
  if (camera) {
    return this._removeTrack(camera);
  }
  return null;
};

/**
 * Add a <code>MediaStream</code> to the {@link LocalMedia} object, constructing
 * {@link LocalTrack}s as necessary for each <code>MediaStreamTrack</code> contained
 * within.
 * @param {MediaStream} mediaStream - The <code>MediaStream</code> to add
 * @returns {LocalMedia}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addStream = function addStream(mediaStream) {
  mediaStream.getAudioTracks().forEach(function(mediaStreamTrack) {
    var audioTrack = new LocalAudioTrack(mediaStream, mediaStreamTrack);
    this._addTrack(audioTrack);
  }, this);
  mediaStream.getVideoTracks().forEach(function(mediaStreamTrack) {
    var videoTrack = new LocalVideoTrack(mediaStream, mediaStreamTrack);
    this._addTrack(videoTrack);
  }, this);
  return this;
};

LocalMedia.prototype._removeTrack = function _removeTrack(track) {
  track.stop();
  Media.prototype._removeTrack.call(this, track);
  try {
    track.mediaStream.removeTrack(track.mediaStreamTrack);
  } catch (error) {
    // Firefox doesn't support removeStream/removeTrack, so we can't yet truly
    // remove and renegotiate media.
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
  muted = typeof muted === 'boolean' ? muted : true;
  this.audioTracks.forEach(function(track) {
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
  paused = typeof paused === 'boolean' ? paused : true;
  this.videoTracks.forEach(function(track) {
    track.enable(!paused);
  });
  return this;
};

/**
 * Stop all {@link LocalAudioTrack}s and {@link LocalVideoTrack}s on this {@link LocalMedia} object.
 * @returns {LocalMedia}
 * @fires Media#trackEnded
 */
LocalMedia.prototype.stop = function stop() {
  this.tracks.forEach(function(track) {
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
 * You may pass these options to {@link LocalMedia.getLocalMedia} to
 * override the default behavior.
 * @typedef {object} LocalMedia.GetLocalMediaOptions
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code>
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = LocalMedia;
