'use strict';

var EventEmitter = require('events').EventEmitter;
var getUserMedia = require('../webrtc/getusermedia');
var inherits = require('util').inherits;
var Map = require('es6-map');
var Q = require('q');
var Set = require('es6-set');

var Track = require('./track');
var AudioTrack = Track.AudioTrack;
var VideoTrack = Track.VideoTrack;

/**
 * Construct a {@link Media} object.
 * @class
 * @classdesc A {@link Media} object contains a number of {@link AudioTrack}s
 *   and {@link VideoTrack}s. You can call {@link Media#attach} with a
 *   &lt;div&gt; to automatically update your application's user interface with
 *   &lt;audio&gt; and &lt;video&gt; elements as {@link Track}s are added and
 *   removed.
 * @property {Map<HTMLElement, Map<Track, HTMLElement>>} attachments - a Map
 *   from &lt;div&gt; elements to a Map from {@link Track}s to their attached
 *   HTMLElements (managed by {@link Media#attach} and {@link Media#detach})
 * @property {Set<AudioTrack>} audioTracks - the Set of {@link AudioTrack}s on
 *   this {@link Media} object
 * @property {Set<MediaStream>} mediaStreams - the MediaStreams associated with
 *   the {@link Track}s on this {@link Media} object
 * @property {Set<VideoTrack>} videoTracks - the Set of {@link VideoTrack}s on
 *   this {@link Media} object
 * @fires trackAdded
 * @fires trackRemoved
 */
function Media(peerConnection) {
  EventEmitter.call(this);
  var attachments = new Map();
  var audioTracks = new Set();
  var mediaStreams = new Set();
  var videoTracks = new Set();
  Object.defineProperties(this, {
    'attachments': {
      enumerable: true,
      value: attachments
    },
    'audioTracks': {
      enumerable: true,
      value: audioTracks
    },
    'mediaStreams': {
      enumerable: true,
      value: mediaStreams
    },
    'videoTracks': {
      enumerable: true,
      value: videoTracks
    }
  });
  return this;
}

inherits(Media, EventEmitter);

Media.prototype._addStream = addStream;

Media.prototype._addTrack = function _addTrack(track) {
  var self = this;
  this.mediaStreams.add(track.mediaStream);
  (track.kind === 'audio' ? this.audioTracks : this.videoTracks).add(track);
  track.once('ended', function ended(event) {
    self._removeTrack(track);
  });
  this.emit('trackAdded', track);
  return this;
};

Media.prototype._attachTrack = function _attachTrack(el, attachments, track) {
  var self = this;
  var trackEl = track.attach();
  // NOTE(mroberts): We want to mute local audio, otherwise we get feedback.
  if (this instanceof LocalMedia && track instanceof AudioTrack) {
    trackEl.muted = true;
  }
  el.appendChild(trackEl);
  attachments.set(track, trackEl);
  track.once('ended', function() {
    self._detachTrack(el, attachments, track);
  });
  return this;
};

Media.prototype._detachTrack = function _detachTrack(el, attachments, track) {
  var trackEl = attachments.get(track);
  track.detach(trackEl);
  el.removeChild(trackEl);
  attachments.delete(track);
  return this;
};

Media.prototype._removeTrack = function _removeTrack(track) {
  this.mediaStreams.delete(track.mediaStream);
  (track.kind === 'audio' ? this.audioTracks : this.videoTracks).delete(track);
  this.emit('trackRemoved', track);
  return this;
};

/**
 * Attaches this {@link Media} object to a &lt;div&gt;. As {@link AudioTrack}s
 * and {@link VideoTrack}s are added and removed, {@link Media} will add and
 * remove &lt;audio&gt; and &lt;video&gt; elements to the &lt;div&gt; by
 * calling out to {@link AudioTrack#attach} and {@link VideoTrack#attach},
 * respectively.
 * <br><br>
 * If a string is provided, it will be passed to
 * <code>document.querySelector</code> to retrieve the &lt;div&gt;.
 * <br><br>
 * If no &lt;div&gt; is provide, this method creates one.
 * @instance
 * @param {(HTMLElement|string)} [div] - the &lt;div&gt; to attach to
 * @returns {HTMLElement}
 */
Media.prototype.attach = function attach(el) {
  var self = this;
  if ((!el || typeof el === 'string') && typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  if (el && typeof el === 'string') {
    el = document.querySelector(el);
    if (!el) {
      throw new Error('document.querySelector returned nothing');
    }
  }
  if (el && this.attachments.has(el)) {
    this.detach(el);
  }
  el = el || document.createElement('div');
  var attachments = new Map();
  [this.audioTracks, this.videoTracks].forEach(function(tracks) {
    tracks.forEach(function(track) {
      this._attachTrack(el, attachments, track);
    }, this);
  }, this);
  this.on('trackAdded', function trackAdded(track) {
    if (!self.attachments.has(el)) {
      return self.removeListener('trackAdded', trackAdded);
    }
    self._attachTrack(el, attachments, track);
  });
  this.attachments.set(el, attachments);
  return el;
};

/**
 * Detach this {@link Media} object from a &lt;div&gt; element. If no
 * &lt;div&gt; is provided, this method detaches {@link Media} from all
 * HTMLElements.
 * <br><br>
 * If a string is provided, it will be passed to
 * <code>document.querySelectorAll</code> to retrieve the &lt;div&gt;(s).
 * @instance
 * @param {(HTMLElement|string)} [div] - the &lt;div&gt; to detach from
 * @returns {Media}
 */
Media.prototype.detach = function detach(el) {
  var self = this;
  if (el && typeof el === 'string' && typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  if (el) {
    if (typeof el === 'string') {
      [].forEach.call(document.querySelectorAll(el), function(el) {
        this.detach(el);
      }, this);
    } else if (this.attachments.has(el)) {
      var attachments = this.attachments.get(el);
      this.attachments.delete(el);
      attachments.forEach(function(trackEl, track) {
        this._detachTrack(el, attachments, track);
      }, this);
    }
  } else {
    this.attachments.forEach(function(attachments, el) {
      this.detach(el);
    }, this);
  }
  return this;
};

/**
 * Construct a {@link LocalMedia} object.
 * @class
 * @classdesc A {@link LocalMedia} object is a {@link Media} object representing
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
      var mediaStreamTrack = mediaStream.audioTracks[0];
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
 * {@link LocalMedia} object, if not already added.
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
      var mediaStreamTrack = mediaStream.videoTracks[0];
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

LocalMedia.prototype.addStream = addStream;

function addStream(mediaStream) {
  /* jshint validthis:true */
  this.mediaStreams.add(mediaStream);
  mediaStream.getAudioTracks().forEach(function(mediaStreamTrack) {
    var audioTrack = new AudioTrack(mediaStream, mediaStreamTrack);
    this._addTrack(audioTrack);
  }, this);
  mediaStream.getVideoTracks().forEach(function(mediaStreamTrack) {
    var videoTrack = new VideoTrack(mediaStream, mediaStreamTrack);
    this._addTrack(videoTrack);
  }, this);
  return this;
}

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

Media.LocalMedia = LocalMedia;

module.exports = Media;
