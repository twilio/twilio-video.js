/* globals webkitMediaStream, MediaStream */
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var nInstances = 0;

/**
 * Construct a {@link Track} from a MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link Track} represents audio or video that can be sent to or
 * received from a {@link Room}. {@link Track}s abstract away the notion
 * of MediaStream and MediaStreamTrack.
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {TrackSignaling} signaling
 * @param {{log: Log}} options
 * @property {Track.ID} id - This {@link Track}'s ID
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
 * @fires Track#started
 */
function Track(mediaStream, mediaStreamTrack, signaling, options) {
  EventEmitter.call(this);
  var isStarted = false;
  /* istanbul ignore next */
  Object.defineProperties(this, {
    _instanceId: {
      value: ++nInstances
    },
    _isStarted: {
      get: function() {
        return isStarted;
      },
      set: function(_isStarted) {
        isStarted = _isStarted;
      }
    },
    _log: {
      value: options.log.createLog('media', this)
    },
    _signaling: {
      value: signaling
    },
    attachments: {
      value: new Set()
    },
    id: {
      enumerable: true,
      value: mediaStreamTrack.id
    },
    isEnabled: {
      enumerable: true,
      get: function() {
        return signaling.isEnabled;
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

Track.DISABLED = 'disabled';
Track.ENABLED = 'enabled';
var STARTED = Track.STARTED = 'started';

inherits(Track, EventEmitter);

Track.prototype._start = function _start() {
  this._log.debug('Started');
  this._isStarted = true;
  this._detachElement(this._dummyEl);
  this._dummyEl.oncanplay = null;
  this.emit(STARTED, this);
};

Track.prototype._initialize = function _initialize() {
  var self = this;

  this._log.debug('Initializing');
  this._dummyEl = this._createElement();

  this._dummyEl.muted = true;
  this._dummyEl.oncanplay = this._start.bind(this, this._dummyEl);
  this._reemit = function reemmit() {
    self.emit(self.isEnabled ? 'enabled' : 'disabled', self);
  };
  this._signaling.on('updated', this._reemit);

  this._attach(this._dummyEl);
};

Track.prototype._end = function _end() {
  this._log.debug('Ended');
  this._signaling.removeListener('updated', this._reemit);
  this._detachElement(this._dummyEl);
  this._dummyEl.oncanplay = null;
};

Track.prototype.attach = function attach(el) {
  if (typeof el === 'string') {
    el = this._selectElement(el);
  } else if (!el) {
    el = this._createElement();
  }
  this._log.debug('Attempting to attach to element:', el);
  el = this._attach(el);

  return el;
};

Track.prototype._attach = function _attach(el) {
  if (this.attachments.has(el)) {
    return el;
  }

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('Can not attach track to page: global.navigator and global.window are required.');
  }

  var _MediaStream = typeof webkitMediaStream !== 'undefined'
    ? webkitMediaStream
    : MediaStream;
  var mediaStream = new _MediaStream();
  mediaStream.addTrack(this.mediaStreamTrack);

  if (typeof navigator.webkitGetUserMedia === 'function') {
    var vendorURL = window.URL || window.webkitURL;
    el.src = vendorURL.createObjectURL(mediaStream);
  } else if (typeof navigator.mozGetUserMedia === 'function') {
    el.mozSrcObject = mediaStream;
  }

  el.autoplay = true;
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

  this._log.debug('Attempting to detach from elements:', els);
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
 * The {@link Track} started. This means that the {@link Track} contains
 * enough audio or video to begin playback.
 * @param {Track} track - The {@link Track} that started
 * @event Track#started
 */

module.exports = Track;
