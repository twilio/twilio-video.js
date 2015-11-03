'use strict';

var getUserMedia = require('../webrtc/getusermedia');
var inherits = require('util').inherits;
var Media = require('./');
var Q = require('q');


var AudioTrack = require('./track/audiotrack');
var VideoTrack = require('./track/videotrack');

/**
 * Construct a {@link LocalMedia} object.
 * @class
 * @classdesc A {@link LocalMedia} object is a {@link Media} object representing
 *   {@link AudioTrack}s and {@link VideoTrack}s that your {@link Client} may
 *   share in a {@link Conversation}.
 * @augments Media
 */
function LocalMedia() {
  if (!(this instanceof LocalMedia)) {
    return new LocalMedia();
  }
  Media.call(this);
  return this;
}

/**
 * Get {@link LocalMedia}. By default, this requests an
 * {@link AudioTrack} and a {@link VideoTrack} representing a microphone and
 * camera.
 * <br><br>
 * This method calls <code>getUserMedia</code> internally. Pass in
 * <code>options</code> to override the default behavior.
 * @param {?LocalMedia#GetLocalMediaOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link LocalMedia.getLocalMedia}'s default behavior
 * @returns {Promise<LocalMedia>}
 */
LocalMedia.getLocalMedia = function getLocalMedia(options) {
  options = options || {};
  if (options['localMedia']) {
    return new Q(options['localMedia']);
  }
  var localMedia = new LocalMedia();
  if (options['localStream']) {
    localMedia.addStream(options['localStream']);
    return new Q(localMedia.addStream(options['localStream']));
  }
  return getUserMedia(options['localStreamConstraints'])
    .then(function(mediaStream) {
      return localMedia.addStream(mediaStream);
    });
};

inherits(LocalMedia, Media);

/**
 * Adds an {@link AudioTrack} representing your browser's microphone to the
 * {@link LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ audio: true })</code>.
 * @returns {Promise<AudioTrack>}
 */
LocalMedia.prototype.addMicrophone = function addMicrophone() {
  var self = this;
  var microphone = null;
  this.audioTracks.forEach(function(audioTrack) {
    microphone = microphone || (audioTrack.label === 'microphone' && audioTrack);
  });
  if (microphone) {
    return new Q(microphone);
  }
  return getUserMedia({ 'audio': true, 'video': false })
    .then(function gotMicrophone(mediaStream) {
      var audioTracks = mediaStream.getAudioTracks();
      var mediaStreamTrack = audioTracks[0];
      var audioTrack = new AudioTrack(mediaStream, mediaStreamTrack);
      self._addTrack(audioTrack);
      return audioTrack;
    });
};

/**
 * Removes the {@link AudioTrack} representing your browser's microphone, if it
 * has been added.
 * @returns {?AudioTrack}
 */
LocalMedia.prototype.removeMicrophone = function removeMicrophone() {
  var microphone = null;
  this.audioTracks.forEach(function(audioTrack) {
    microphone = microphone || (audioTrack.label === 'microphone' && audioTrack);
  });
  if (microphone) {
    return this._removeTrack(microphone);
  }
  return null;
};

/**
 * Adds a {@link VideoTrack} representing your browser's camera to the
 * {@link LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ video: true })</code>.
 * @returns {Promise<VideoTrack>}
 */
LocalMedia.prototype.addCamera = function addCamera() {
  var self = this;
  var camera = null;
  this.videoTracks.forEach(function(videoTrack) {
    camera = camera || (videoTrack.label === 'camera' && videoTrack);
  });
  if (camera) {
    return new Q(camera);
  }
  return getUserMedia({ 'audio': false, 'video': true })
    .then(function gotCamera(mediaStream) {
      var videoTracks = mediaStream.getVideoTracks();
      var mediaStreamTrack = videoTracks[0];
      var videoTrack = new VideoTrack(mediaStream, mediaStreamTrack);
      self._addTrack(videoTrack);
      return videoTrack;
    });
};

/**
 * Removes the {@link VideoTrack} representing your browser's camera, if it
 * has been added.
 * @returns {?VideoTrack}
 */
LocalMedia.prototype.removeCamera = function removeCamera() {
  var camera = null;
  this.videoTracks.forEach(function(videoTrack) {
    camera = camera || (videoTrack.label === 'camera' && videoTrack);
  });
  if (camera) {
    return this._removeTrack(camera);
  }
  return null;
};

/**
 * Add a <code>MediaStream</code> to the {@link LocalMedia} object, constructing
 * {@link Track}s as necessary for each <code>MediaStreamTrack</code> contained
 * within.
 * @method
 * @returns {LocalMedia}
 */
LocalMedia.prototype.addStream = Media.prototype._addStream;

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
 * Disable every {@link AudioTrack} on this {@link LocalMedia} object.
 * @returns {this}
*//**
 * Disable or enable every {@link AudioTrack} on this {@link LocalMedia} object.
 * @param {?boolean} enabled - Specify false to enable the {@link AudioTrack}s
 * @returns {this}
 */
LocalMedia.prototype.mute = function mute(muted) {
  muted = typeof muted === 'boolean' ? muted : true;
  this.audioTracks.forEach(function(track) {
    track.enable(!muted);
  });
  return this;
};

/**
 * Disable every {@link VideoTrack} on this {@link LocalMedia} object.
 * @returns {this}
*//**
 * Disable or enable every {@link VideoTrack} on this {@link LocalMedia} object.
 * @param {?boolean} enabled - Specify false to enable the {@link VideoTrack}s
 * @returns {this}
 */
LocalMedia.prototype.pause = function pause(paused) {
  paused = typeof paused === 'boolean' ? paused : true;
  this.videoTracks.forEach(function(track) {
    track.enable(!paused);
  });
  return this;
};

/**
 * Stop all audio and video {@link Track}s on this {@link LocalMedia} object.
 * @returns {LocalMedia}
 */
LocalMedia.prototype.stop = function stop() {
  this.tracks.forEach(function(track) {
    track.stop();
  });
  return this;
};

/**
 * Enable every {@link AudioTrack} on this {@link LocalMedia} object.
 * @returns {this}
 */
LocalMedia.prototype.unmute = function unmute() {
  return this.mute(false);
};

/**
 * Enable every {@link VideoTrack} on this {@link LocalMedia} object.
 * @returns {this}
 */
LocalMedia.prototype.unpause = function unpause() {
  return this.pause(false);
};

/**
 * You may pass these options to {@link LocalMedia.getLocalMedia} to
 * override the default behavior.
 * @typedef {object} LocalMedia#GetLocalMediaOptions
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code>
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = LocalMedia;
