'use strict';

var getUserMedia = require('../webrtc/getusermedia');
var inherits = require('util').inherits;
var Media = require('./');
var Q = require('q');


var AudioTrack = require('./track/audiotrack');
var VideoTrack = require('./track/videotrack');

/**
 * Construct a {@link Twilio.LocalMedia} object.
 * @memberof Twilio
 * @class
 * @classdesc A {@link Twilio.LocalMedia} object is a {@link Media} object representing
 *   {@link AudioTrack}s and {@link VideoTrack}s that your {@link Endpoint} may
 *   share in a {@link Conversation}.
 * @augments Media
 */
function LocalMedia() {
  if (!(this instanceof LocalMedia)) {
    return new LocalMedia();
  }
  Media.call(this);
  var nextUserMedia = null;
  /* istanbul ignore next */
  Object.defineProperties(this, {
    _needs: {
      value: new Set()
    },
    _nextUserMedia: {
      get: function() {
        return nextUserMedia;
      },
      set: function(_nextUserMedia) {
        nextUserMedia = _nextUserMedia;
      }
    }
  });
  return Object.freeze(this);
}


LocalMedia.TRACK_MUTED = Media.TRACK_MUTED;
LocalMedia.TRACK_UNMUTED = Media.TRACK_UNMUTED;
LocalMedia.TRACK_PAUSED = Media.TRACK_PAUSED;
LocalMedia.TRACK_UNPAUSED = Media.TRACK_UNPAUSED;
LocalMedia.TRACK_EVENTS = Media.TRACK_EVENTS;

/**
 * Get {@link Twilio.LocalMedia}. By default, this requests an
 * {@link AudioTrack} and a {@link VideoTrack} representing a microphone and
 * camera.
 * <br><br>
 * This method calls <code>getUserMedia</code> internally. Pass in
 * <code>options</code> to override the default behavior.
 * @param {?Twilio.LocalMedia#GetLocalMediaOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link Twilio.LocalMedia.getLocalMedia}'s default behavior
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
 * Oh, hai.
 * @instance
 * @returns {string}
 */
LocalMedia.prototype.foo = function foo(){};

/**
 * Adds an {@link AudioTrack} representing your browser's microphone to the
 * {@link Twilio.LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ audio: true })</code>.
 * @instance
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
 * @instance
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
 * {@link Twilio.LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ video: true })</code>.
 * @instance
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
 * @instance
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

LocalMedia.prototype.addStream = Media.prototype._addStream;

LocalMedia.prototype._removeTrack = function _removeTrack(track) {
  var self = this;
  Media.prototype._removeTrack.call(this, track);
  track.mediaStream.stop();
  [this.audioTracks, this.videoTracks].forEach(function(tracks) {
    tracks.forEach(function(_track) {
      if (_track.mediaStream === track.mediaStream) {
        this._removeTrack(_track);
        this._needs.add(_track.label);
        if (!this._nextUserMedia) {
          this._nextUserMedia = setTimeout(function() {
            self._nextUserMedia = null;
            var needsCamera = self._needs.has('camera');
            self._needs.delete('camera');
            var needsMicrophone = self._needs.has('microphone');
            self._needs.delete('microphone');
            if (needsCamera || needsMicrophone) {
              if (needsCamera && !needsMicrophone) {
                self.addCamera();
              } else if (needsMicrophone && !needsCamera) {
                self.addMicrophone();
              } else {
                getUserMedia().then(self.addStream.bind(self));
              }
            }
          });
        }
      }
    }, this);
  }, this);
  this._needs.delete(track.label);
  return track;
};

/**
 * Stop all audio and video {@link Track}s on this {@link Twilio.LocalMedia} object.
 * @instance
 * @returns {Twilio.LocalMedia}
 */
LocalMedia.prototype.stop = function stop() {
  [this.audioTracks, this.videoTracks].forEach(function(tracks) {
    tracks.forEach(function(track) {
      track.stop();
    });
  });
  return this;
};

/**
 * You may pass these options to {@link Twilio.LocalMedia.getLocalMedia} to
 * override the default behavior.
 * @typedef {object} Twilio.LocalMedia#GetLocalMediaOptions
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code>
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = LocalMedia;
