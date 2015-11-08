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
 * @property {string} id - This {@link Track}'s ID
 * @property {boolean} isEnded - Whether or not the {@link Track} has ended
 * @property {boolean} isStarted - Whether or not the {@link Track} has started
 * @property {string} label - This {@link Track}'s label; e.g. "microphone",
 *   "camera"
 * @property {string} kind - The kind of the underlying
 *   {@link MediaStreamTrack}; e.g. "audio" or "video"
 * @property {MediaStream} mediaStream - The underlying MediaStream
 * @property {MediaStreamTrack} mediaStreamTrack - The underlying
 *   MediaStreamTrack
 * @fires Track#disabled
 * @fires Track#enabled
 * @fires Track#ended
 * @fires Track#started
 */
function Track(mediaStream, mediaStreamTrack) {
  EventEmitter.call(this);
  var isEnabled = true;
  var isEnded = false;
  var isStarted = false;
  /* istanbul ignore next */
  Object.defineProperties(this, {
    _isEnabled: {
      get: function() {
        return isEnabled;
      },
      set: function(_isEnabled) {
        isEnabled = _isEnabled;
      }
    },
    _isEnded: {
      get: function() {
        return isEnded;
      },
      set: function(_isEnded) {
        isEnded = _isEnded;
      }
    },
    _isStarted: {
      get: function() {
        return isStarted;
      },
      set: function(_isStarted) {
        isStarted = _isStarted;
      }
    },
    attachments: {
      value: new Set()
    },
    id: {
      enumerable: true,
      value: mediaStreamTrack.id
    },
    isEnabled: {
      get: function() {
        return isEnabled;
      }
    },
    isEnded: {
      get: function() {
        return isEnded;
      }
    },
    isStarted: {
      get: function() {
        return isStarted;
      }
    },
    label: {
      enumerable: true,
      value: mediaStreamTrack.kind === 'audio' ? 'microphone' : 'camera'
    },
    kind: {
      enumerable: true,
      value: mediaStreamTrack.kind
    },
    mediaStream: {
      enumerable: true,
      value: mediaStream
    },
    mediaStreamTrack: {
      enumerable: true,
      value: mediaStreamTrack
    }
  });
  var self = this;
  mediaStreamTrack.onended = function onended() {
    /* eslint no-use-before-define:0 */
    self.emit(ENDED, self);
  };
  emitStartedEvent(this);
}

var DISABLED = Track.DISABLED = 'disabled';
var ENABLED = Track.ENABLED = 'enabled';
var ENDED = Track.ENDED = 'ended';
var STARTED = Track.STARTED = 'started';

function emitStartedEvent(track) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var elem = document.createElement(track.kind);
  elem.muted = true;
  elem.oncanplay = function oncanplay() {
    track.detach(elem);
    track._isStarted = true;
    track.emit(STARTED, track);
    elem.oncanplay = null;
  };
  track.once(ENDED, function() {
    track.detach(elem);
    elem.oncanplay = null;
  });
  return track.attach(elem);
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

Track.attachAudio = attachAudio;

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

Track.attachVideo = attachVideo;

inherits(Track, EventEmitter);

Track.prototype._enable = function _enable(enabled) {
  if (this._isEnabled !== enabled) {
    this._isEnabled = enabled;
    this.emit(enabled ? ENABLED : DISABLED, this);
  }
  return this;
};

Track.prototype.attach = function attach() {
  var args = [].slice.call(arguments);
  args.unshift(this);
  return attachAudioOrVideoTrack.apply(this, args);
};

Track.prototype.detach = function detach() {
  var args = [].slice.call(arguments);
  args.unshift(this);
  return detachAudioOrVideoTrack.apply(this, args);
};

/**
 * Disable the {@link Track}.
 * @returns {this}
 * @fires Track#disabled
 */
Track.prototype.disable = function disable() {
  return this.enable(false);
};

/**
 * Enable the {@link Track}.
 * @returns {this}
 * @fires Track#enabled
*//**
 * Enable or disable the {@link Track}.
 * @param {boolean} [enabled] - Specify false to disable the {@link Track}
 * @returns {this}
 * @fires Track#disabled
 * @fires Track#enabled
 */
Track.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  this.mediaStreamTrack.enabled = enabled;
  return this._enable(enabled);
};

/**
 * Stop sending this {@link Track}.
 * @returns {Track}
 * @fires Track#ended
 */
Track.prototype.stop = function stop() {
  this.mediaStreamTrack.stop();
  return this;
};

function attachAudioOrVideoTrack(track, el) {
  if (!el) {
    return createElementAndAttachAudioOrVideoTrack(track);
  } else if (typeof el === 'string') {
    return selectElementAndAttachAudioOrVideoTrack(track, el);
  }
  return attachAudioOrVideoTrackToElement(track, el);
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
  }
  return detachAudioOrVideoTrackFromElement(track, el);
}

Track.detachAudioOrVideoTrack = detachAudioOrVideoTrack;

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

/**
 * The {@link Track} was disabled. For {@link AudioTrack}s this means
 * "muted", and for {@link VideoTrack}s this means "paused".
 * @param {Track} track - The {@link Track} that was disabled
 * @event Track#disabled
 */

/**
 * The {@link Track} was enabled. For {@link AudioTrack}s this means
 * "unmuted", and for {@link VideoTrack}s this means "unpaused".
 * @param {Track} track - The {@link Track} that was enabled
 * @event Track#enabled
 */

/**
 * The {@link Track} ended. This means that the {@link Track} will no longer
 * playback audio or video.
 * @param {Track} track - The {@link Track} that ended
 * @event Track#ended
 */

/**
 * The {@link Track} started. This means that the {@link Track} contains
 * enough audio or video to begin playback.
 * @param {Track} track - The {@link Track} that started
 * @event Track#started
 */

module.exports = Track;
