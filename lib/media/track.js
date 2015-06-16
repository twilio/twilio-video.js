'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct a {@link Track} from a MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link Track} represents audio or video that can be sent to or
 * received from a {@link Conversation}. {@link Track}s abstract away the notion
 * of MediaStream and MediaStreamTrack.
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 * @property {string} label - This {@link Track}'s label; e.g. "microphone",
 *   "camera"
 * @property {string} kind - The kind of the underlying
 *   {@link MediaStreamTrack}; e.g. "audio" or "video"
 * @property {MediaStream} mediaStream - The underlying MediaStream
 * @property {MediaStreamTrack} mediaStreamTrack - The underlying
 *   MediaStreamTrack
 */
function Track(mediaStream, mediaStreamTrack) {
  EventEmitter.call(this);
  /* istanbul ignore next */
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
 * @property {boolean} muted - Whether or not this {@link AudioTrack} is muted
 *   or not; set this value to mute and unmute the {@link AudioTrack}
 * @property {Set<HTMLElement>} attachments - The &lt;audio&gt; elements this
 *   {@link AudioTrack} is currently attached to (managed by
 *   {@link AudioTrack#attach})
 * @augments Track
 */
function AudioTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof AudioTrack)) {
    return new AudioTrack(mediaStream, mediaStreamTrack);
  }
  Track.call(this, mediaStream, mediaStreamTrack);
  /* istanbul ignore next */
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
    'attachments': {
      enumerable: true,
      value: new Set()
    }
  });
  return Object.freeze(this);
}

inherits(AudioTrack, Track);

/**
 * Attach {@link AudioTrack} to a newly created &lt;audio&gt; element.
 * @instance
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = audioTrack.attach();
 * document.getElementById('div#remote-audio-container').appendChild(remoteAudioEl);
*//**
 * Attach {@link AudioTrack} to an existing &lt;audio&gt; element.
 * @instance
 * @param {HTMLElement} audio - The &lt;audio&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = document.getElementById('remote-audio');
 * audioTrack.attach(remoteAudioEl);
*//**
 * Attach {@link AudioTrack} to a &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @instance
 * @param {string} selector - A query selector for the &lt;audio&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = audioTrack.attach('audio#remote-audio');
 */
AudioTrack.prototype.attach = function attach(audio) {
  return attachAudioOrVideoTrack(this, audio);
};

/**
 * Detach {@link AudioTrack} from any and all previously attached &lt;audio&gt; elements.
 * @instance
 * @returns {Array<HTMLElement>}
 * @example
 * var detachedAudioEls = audioTrack.detach();
*//**
 * Detach {@link AudioTrack} from a previously attached &lt;audio&gt; element.
 * @instance
 * @param {HTMLElement} audio - The &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = document.getElementById('remote-audio');
 * audioTrack.detach(remoteAudioEl);
*//**
 * Detach {@link AudioTrack} from a previously attached &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @instance
 * @param {string} selector - A query selector for the &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedAudioEl = media.detach('div#remote-audio');
 */
AudioTrack.prototype.detach = function detach(audio) {
  return detachAudioOrVideoTrack(this, audio);
};

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
 * @property {boolean} paused - Whether or not this {@link VideoTrack} is
 *   paused or not; set this value to pause and unpause the {@link VideoTrack}
 * @property {Set<HTMLElement>} attachments - The &lt;video&gt; elements this
 *   {@link VideoTrack} is currently attached to (managed by
 *   {@link VideoTrack#attach})
 * @augments Track
 */
function VideoTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof VideoTrack)) {
    return new VideoTrack(mediaStream, mediaStreamTrack);
  }
  Track.call(this, mediaStream, mediaStreamTrack);
  /* istanbul ignore next */
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
    'attachments': {
      value: new Set()
    }
  });
  mediaStream.onaddtrack = function onaddtrack() {
    this.attachments.forEach(function(video) {
      detachAudioOrVideoTrack(this, video);
      attachVideo(video, mediaStream);
    }, this);
  }.bind(this);
  return Object.freeze(this);
}

inherits(VideoTrack, Track);

/**
 * Attach {@link VideoTrack} to a newly created &lt;video&gt; element.
 * @instance
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = videoTrack.attach();
 * document.getElementById('div#remote-video-container').appendChild(remoteVideoEl);
*//**
 * Attach {@link VideoTrack} to an existing &lt;video&gt; element.
 * @instance
 * @param {HTMLElement} video - The &lt;video&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = document.getElementById('remote-video');
 * videoTrack.attach(remoteVideoEl);
*//**
 * Attach {@link VideoTrack} to a &lt;video&gt; element selected by
 * <code>document.querySelector</code>.
 * @instance
 * @param {string} selector - A query selector for the &lt;video&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = videoTrack.attach('video#remote-video');
 */
VideoTrack.prototype.attach = function attach(video) {
  return attachAudioOrVideoTrack(this, video);
};

/**
 * Detach {@link AudioTrack} from any and all previously attached &lt;audio&gt; elements.
 * @instance
 * @returns {Array<HTMLElement>}
 * @example
 * var detachedAudioEls = audioTrack.detach();
*//**
 * Detach {@link AudioTrack} from a previously attached &lt;audio&gt; element.
 * @instance
 * @param {HTMLElement} audio - The &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = document.getElementById('remote-audio');
 * audioTrack.detach(remoteAudioEl);
*//**
 * Detach {@link AudioTrack} from a previously attached &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @instance
 * @param {string} selector - A query selector for the &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedAudioEl = media.detach('div#remote-audio');
 */
VideoTrack.prototype.detach = function detach(video) {
  return detachAudioOrVideoTrack(this, video);
};

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
  if (!el) {
    return createElementAndAttachAudioOrVideoTrack(track);
  } else if (typeof el === 'string') {
    return selectElementAndAttachAudioOrVideoTrack(track, el);
  } else {
    return attachAudioOrVideoTrackToElement(track, el);
  }
}

function attachAudioOrVideoTrackToElement(track, el) {
  if (track.attachments.has(el)) {
    return el;
  }
  var attachMethod = track.kind === 'audio' ? attachAudio : attachVideo;
  attachMethod(el, track.mediaStream);
  track.attachments.add(el);
  return el;
}

function selectElementAndAttachAudioOrVideoTrack(track, selector) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var el = document.querySelector(selector);
  if (!el) {
    throw new Error('document.querySelector returned nothing');
  }
  return attachAudioOrVideoTrackToElement(track, el);
}

function createElementAndAttachAudioOrVideoTrack(track) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var el = document.createElement(track.kind);
  return attachAudioOrVideoTrackToElement(track, el);
}

function detachAudioOrVideoTrack(track, el) {
  if (!el) {
    return detachAudioOrVideoTrackFromAllElements(track);
  } else if (typeof el === 'string') {
    return selectElementAndDetachAudioOrVideoTrack(track, el);
  } else {
    return detachAudioOrVideoTrackFromElement(track, el);
  }
}

function detachAudioOrVideoTrackFromElement(track, el) {
  if (!track.attachments.has(el)) {
    return el;
  }
  el.removeAttribute('src');
  track.attachments.delete(el);
  return el;
}

function selectElementAndDetachAudioOrVideoTrack(track, selector) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var el = document.querySelector(selector);
  if (!el) {
    throw new Error('document.querySelector returned nothing');
  }
  return detachAudioOrVideoTrackFromElement(track, el);
}

function detachAudioOrVideoTrackFromAllElements(track) {
  var els = [];
  track.attachments.forEach(function(el) {
    els.push(el);
    detachAudioOrVideoTrackFromElement(track, el);
  });
  return els;
}

Track.AudioTrack = AudioTrack;
Track.VideoTrack = VideoTrack;

module.exports = Track;
