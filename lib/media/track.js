'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Set = require('es6-set');

/**
 * Construct a {@link Track} from a MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link Track} represents audio or video that can be sent to or
 * received from a {@link Conversation}. {@link Track}s abstract away the notion
 * of MediaStream and MediaStreamTrack.
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 * @property {string} label - this {@link Track}'s label; e.g. "microphone",
 *   "camera"
 * @property {string} kind - the kind of the underlying
 *   {@link MediaStreamTrack}; e.g. "audio" or "video"
 * @property {MediaStream} mediaStream - the underlying MediaStream
 * @property {MediaStreamTrack} mediaStreamTrack - the underlying
 *   MediaStreamTrack
 */
function Track(mediaStream, mediaStreamTrack) {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    'label': {
      enumerable: true,
      value: mediaStreamTrack.kind === 'audio' ? 'microphone' : 'camera'
    },
    'kind': {
      enumerable: true,
      value: mediaStreamTrack.kind
    },
    'mediaStream': {
      enumerable: true,
      value: mediaStream
    },
    'mediaStreamTrack': {
      enumerable: true,
      value: mediaStreamTrack
    }
  });
  var self = this;
  mediaStreamTrack.onended = function onended() {
    self.emit('ended', self);
  };
}

inherits(Track, EventEmitter);

/**
 * Stop sending this {@link Track}.
 * @instance
 * @returns {Track}
 */
Track.prototype.stop = function stop() {
  this.mediaStreamTrack.stop();
  return this;
};

/**
 * Construct an {@link AudioTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc An {@link AudioTrack} is a {@link Track} representing audio.
 * @param {MediaStream} mediaStream
 * @param {MediaSTreamTrack} mediaStreamTrack
 * @property {boolean} muted - whether or not this {@link AudioTrack} is muted
 *   or not; set this value to mute and unmute the {@link AudioTrack}
 * @property {Set<HTMLElement>} audioElements - the &lt;audio&gt; elements this
 *   {@link AudioTrack} is currently attached to (managed by
 *   {@link AudioTrack#attach})
 * @augments Track
 */
function AudioTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof AudioTrack)) {
    return new AudioTrack(mediaStream, mediaStreamTrack);
  }
  Track.call(this, mediaStream, mediaStreamTrack);
  Object.defineProperties(this, {
    'muted': {
      enumerable: true,
      get: function() {
        return !mediaStreamTrack.enabled;
      },
      set: function(muted) {
        mediaStreamTrack.enabled = !muted;
      }
    },
    'audioElements': {
      enumerable: true,
      value: new Set()
    }
  });
  return Object.freeze(this);
}

inherits(AudioTrack, Track);

/**
 * @instance
 * @param {?HTMLElement} audio
 * @returns {HTMLElement}
 */
AudioTrack.prototype.attach = function attach(audio) {
  if (!audio && typeof document === 'undefined') {
    throw new Error('Cannot create <audio> element');
  }
  audio = attachAudio(audio || document.createElement('audio'), this.mediaStream);
  this.audioElements.add(audio);
  return audio;
};

AudioTrack.prototype.detach = function detach(audio) {
  if (audio && this.audioElements.has(audio)) {
    detachAudio(audio);
    this.audioElements.delete(audio);
    return audio;
  }
  var audios = [];
  this.audioElements.forEach(function(audio) {
    this.detach(audio);
    audios.push(audio);
  }, this);
  return audios;
};

function detachAudio(audio) {
  audio.removeAttribute('src');
  return audio;
}

function attachAudio(audio, mediaStream) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    if (typeof navigator.webkitGetUserMedia === 'function') {
      var vendorURL = window.URL || window.webkitURL;
      audio.src = vendorURL.createObjectURL(mediaStream);
    } else if (typeof navigator.mozGetUserMedia === 'function') {
      audio.mozSrcObject = mediaStream;
    }
    audio.play();
    return audio;
  }
  throw new Error('Cannot attach to <audio> element');
}

/**
 * Construct a {@link VideoTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link VideoTrack} is a {@link Track} representing video.
 * @param {MediaStream} mediaStream
 * @param {MediaSTreamTrack} mediaStreamTrack
 * @property {boolean} paused - whether or not this {@link VideoTrack} is
 *   paused or not; set this value to pause and unpause the {@link VideoTrack}
 * @property {Set<HTMLElement>} videoElements - the &lt;video&gt; elements this
 *   {@link VideoTrack} is currently attached to (managed by
 *   {@link VideoTrack#attach})
 * @augments Track
 */
function VideoTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof VideoTrack)) {
    return new VideoTrack(mediaStream, mediaStreamTrack);
  }
  Track.call(this, mediaStream, mediaStreamTrack);
  Object.defineProperties(this, {
    'paused': {
      enumerable: true,
      get: function() {
        return !mediaStreamTrack.enabled;
      },
      set: function(paused) {
        mediaStreamTrack.enabled = !paused;
      }
    },
    'videoElements': {
      value: new Set()
    }
  });
  mediaStream.onaddtrack = function onaddtrack() {
    this.videoElements.forEach(function(video) {
      detachVideo(video);
      attachVideo(video, mediaStream);
    });
  }.bind(this);
  return Object.freeze(this);
}

inherits(VideoTrack, Track);

/**
 * @instance
 * @param {?HTMLElement} video
 * @returns {HTMLElement}
 */
VideoTrack.prototype.attach = function attach(video) {
  if (!video && typeof document === 'undefined') {
    throw new Error('Cannot create <video> element');
  }
  video = attachVideo(video || document.createElement('video'), this.mediaStream);
  this.videoElements.add(video);
  return video;
};

VideoTrack.prototype.detach = function detach(video) {
  if (video && this.videoElements.has(video)) {
    detachVideo(video);
    this.videoElements.delete(video);
    return video;
  }
  var videos = [];
  this.videoElements.forEach(function(video) {
    this.detach(video);
    videos.push(video);
  }, this);
  return videos;
};

function detachVideo(video) {
  video.removeAttribute('src');
  return video;
}

function attachVideo(video, mediaStream) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    if (typeof navigator.webkitGetUserMedia === 'function') {
      var vendorURL = window.URL || window.webkitURL;
      video.src = vendorURL.createObjectURL(mediaStream);
    } else if (typeof navigator.mozGetUserMedia === 'function') {
      video.mozSrcObject = mediaStream;
    }
    video.muted = true;
    video.play();
    return video;
  }
  throw new Error('Cannot attach to <video> element');
}

Track.AudioTrack = AudioTrack;
Track.VideoTrack = VideoTrack;

module.exports = Track;
