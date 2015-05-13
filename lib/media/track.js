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
 * Attach this {@link AudioTrack} to an &lt;audio&gt; element. If none is
 * provided, this method creates a new &lt;audio&gt; element. If a string is
 * provided, it is passed to <code>document.querySelector</code> to retrieve
 * the &lt;audio&gt; element.
 * @instance
 * @param {(HTMLElement|string)} [audio]
 * @returns {HTMLElement}
 */
AudioTrack.prototype.attach = function attach(audio) {
  return attachAudioOrVideoTrack(this, audio);
};

/**
 * Detach this {@link AudioTrack} from a previously attach &lt;audio&gt;
 * element. If none is provided, this method detaches from all &lt;audio&gt;
 * elements. If a string is provided, it is passed to
 * <code>document.querySelectorAll</code> to retrieve the &lt;audio&gt; element.
 * @instance
 * @param {(HTMLElement|string)} [audio]
 * @returns {Array<HTMLElement>} - the detached &lt;audio&gt; elements
 */
AudioTrack.prototype.detach = function detach(audio) {
  return detachAudioOrVideoTrack(this, audio);
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
 * Attach this {@link VideoTrack} to an &lt;video&gt; element. If none is
 * provided, this method creates a new &lt;video&gt; element. If a string is
 * provided, it is passed to <code>document.querySelector</code> to retrieve
 * the &lt;video&gt; element.
 * @instance
 * @param {(HTMLElement|string)} [video]
 * @returns {HTMLElement}
 */
VideoTrack.prototype.attach = function attach(video) {
  return attachAudioOrVideoTrack(this, video);
};

/**
 * Detach this {@link VideoTrack} from a previously attach &lt;video&gt;
 * element. If none is provided, this method detaches from all &lt;video&gt;
 * elements. If a string is provided, it is passed to
 * <code>document.querySelectorAll</code> to retrieve the &lt;video&gt; element.
 * @instance
 * @param {(HTMLElement|string)} [video]
 * @returns {Array<HTMLElement>} - the detached &lt;video&gt; elements
 */
VideoTrack.prototype.detach = function detach(video) {
  return detachAudioOrVideoTrack(this, video);
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

function attachAudioOrVideoTrack(track, el) {
  if ((!el || typeof el === 'string') && typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  if (typeof el === 'string') {
    el = document.querySelector(el);
    if (!el) {
      throw new Error('document.querySelector returned nothing');
    }
  }
  el = el || document.createElement(track.kind);
  var attachMethod;
  var elements;
  if (track.kind === 'audio') {
    attachMethod = attachAudio;
    elements = track.audioElements;
  } else {
    attachMethod = attachVideo;
    elements = track.videoElements;
  }
  if (elements.has(el)) {
    return el;
  }
  el = attachMethod(el, track.mediaStream);
  elements.add(el);
  return el;
}

function detachAudioOrVideoTrack(track, el) {
  if ((!el || typeof el === 'string') && typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  if (typeof el === 'string') {
    return [].map.call(document.querySelectorAll(el), function(el) {
      track.detach(el);
      return el;
    });
  }
  var detachMethod;
  var elements;
  if (track.kind === 'audio') {
    detachMethod = detachAudio;
    elements = track.audioElements;
  } else {
    detachMethod = detachVideo;
    elements = track.videoElements;
  }
  if (el) {
    detachMethod(el);
    elements.delete(el);
    return [el];
  }
  var els = [];
  elements.forEach(function(el) {
    els.push(el);
    this.detach(el);
  }, track);
  return els;
}

Track.AudioTrack = AudioTrack;
Track.VideoTrack = VideoTrack;

module.exports = Track;
