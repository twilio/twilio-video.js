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
 * @property {Track.ID} id - This {@link Track}'s ID
 * @property {boolean} isEnded - Whether or not the {@link Track} has ended
 * @property {boolean} isStarted - Whether or not the {@link Track} has started
 * @property {boolean} isEnabled - Whether or not the {@link Track} is enabled
 *  (i.e., whether it is paused or muted)
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
        // NOTE(mroberts): We can typically trust the MediaStreamTrack's
        // readyState property if it is present; unfortunately, Firefox has
        // not implemented it yet.
        if (typeof mediaStreamTrack.readyState === 'string') {
          return mediaStreamTrack.readyState === 'ended';
        }
        return isEnded;
      }
    },
    isStarted: {
      get: function() {
        return isStarted;
      }
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

  this._initialize();
}

var DISABLED = Track.DISABLED = 'disabled';
var ENABLED = Track.ENABLED = 'enabled';
var ENDED = Track.ENDED = 'ended';
var STARTED = Track.STARTED = 'started';

inherits(Track, EventEmitter);

Track.prototype._start = function _start(dummyEl) {
  this._isStarted = true;
  this._detachElement(dummyEl);
  dummyEl.oncanplay = null;
  this.emit(STARTED, this);
};

Track.prototype._end = function _start(dummyEl) {
  this._detachElement(dummyEl);
  dummyEl.oncanplay = null;
  this.emit(ENDED, this);
};

Track.prototype._initialize = function _initialize() {
  var dummyEl = this._createElement();

  dummyEl.muted = true;
  dummyEl.oncanplay = this._start.bind(this, dummyEl);
  this.mediaStreamTrack.onended = this._end.bind(this, dummyEl);

  this._attach(dummyEl);
};

Track.prototype._enable = function _enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;

  if (this._isEnabled !== enabled) {
    this._isEnabled = enabled;
    this.emit(enabled ? ENABLED : DISABLED, this);
  }

  return this;
};

Track.prototype.attach = function attach(el) {
  if (typeof el === 'string') {
    el = this._selectElement(el);
  } else if (!el) {
    el = this._createElement();
  }

  el = this._attach(el);
  el.play();

  return el;
};

Track.prototype._attach = function _attach(el) {
  if (this.attachments.has(el)) {
    return el;
  }

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('Can not attach track to page: global.navigator and global.window are required.');
  }

  if (typeof navigator.webkitGetUserMedia === 'function') {
    var vendorURL = window.URL || window.webkitURL;
    el.src = vendorURL.createObjectURL(this.mediaStream);
  } else if (typeof navigator.mozGetUserMedia === 'function') {
    el.mozSrcObject = this.mediaStream;
  }

  this.attachments.add(el);
  return el;
};

Track.prototype._selectElement = function _selectElement(selector) {
  var el = document.querySelector(selector);

  if (!el) {
    throw new Error('Selector matched no element: ' + selector);
  }

  return el;
};

Track.prototype._createElement = function _createElement() {
  return document.createElement(this.kind);
};

Track.prototype.detach = function _detach(el) {
  var els;

  if (typeof el === 'string') {
    els = [this._selectElement(el)];
  } else if (!el) {
    els = this._getAllAttachedElements();
  } else {
    els = [el];
  }

  this._detachElements(els);
  return el ? els[0] : els;
};

Track.prototype._detachElements = function _detachElements(elements) {
  return elements.map(this._detachElement.bind(this));
};

Track.prototype._detachElement = function _detachElement(el) {
  if (!this.attachments.has(el)) {
    return el;
  }

  el.removeAttribute('src');
  this.attachments.delete(el);
  return el;
};

Track.prototype._getAllAttachedElements = function _getAllAttachedElements() {
  var els = [];

  this.attachments.forEach(function(el) {
    els.push(el);
  });

  return els;
};

/**
 * The {@link Track} ID is a string identifier for the {@link Track}.
 * @type string
 * @typedef Track.ID
 */

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
