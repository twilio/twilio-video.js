'use strict';

var EventEmitter = require('events').EventEmitter;
var MediaStream = require('../../webrtc/mediastream');
var inherits = require('util').inherits;
var nInstances = 0;

/**
 * Construct a {@link Track} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link Track} represents audio or video that can be sent to or
 * received from a {@link Room}.
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {TrackSignaling} signaling
 * @param {{log: Log}} options
 * @property {Track.ID} id - This {@link Track}'s ID
 * @property {boolean} isStarted - Whether or not the {@link Track} has started
 * @property {boolean} isEnabled - Whether or not the {@link Track} is enabled
 *  (i.e., whether it is paused or muted)
 * @property {string} kind - The kind of the underlying
 *   {@link MediaStreamTrack}; e.g. "audio" or "video"
 * @property {MediaStreamTrack} mediaStreamTrack - The underlying
 *   MediaStreamTrack
 * @fires Track#disabled
 * @fires Track#enabled
 * @fires Track#started
 */
function Track(mediaStreamTrack, signaling, options) {
  EventEmitter.call(this);
  var isStarted = false;

  options = Object.assign({
    MediaStream: MediaStream
  }, options);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _attachments: {
      value: new Set()
    },
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
    _MediaStream: {
      value: options.MediaStream
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

  this.mediaStreamTrack.addEventListener('ended', function onended() {
    self._end();
    self.mediaStreamTrack.removeEventListener('ended', onended);
  });

  this._dummyEl.muted = true;
  this._dummyEl.oncanplay = this._start.bind(this, this._dummyEl);
  this._reemit = function reemmit() {
    self.emit(self.isEnabled ? 'enabled' : 'disabled', self);
  };
  this._signaling.on('updated', this._reemit);

  this._attach(this._dummyEl);
  this._attachments.delete(this._dummyEl);
};

Track.prototype._end = function _end() {
  this._log.debug('Ended');
  this._signaling.removeListener('updated', this._reemit);
  this._detachElement(this._dummyEl);
  this._dummyEl.oncanplay = null;
};

/**
 * Attach the {@link Track} to a newly created HTMLMediaElement.
 *
 * The HTMLMediaElement's <code>srcObject</code> will be set to a new
 * MediaStream containing the {@link Track}'s MediaStreamTrack.
 *
 * @method
 * @returns {HTMLMediaElement} Either an HTMLAudioElement or HTMLVideoElement,
 *    depending on the {@link Track}'s kind
 * @example
 * var Video = require('twilio-video');
 *
 * Video.createLocalVideoTrack().then(function(track) {
 *   var videoElement = track.attach();
 *   document.getElementById('my-container').appendChild(videoElement);
 * });
 *//**
 * Attach the {@link Track} to an existing HTMLMediaElement.
 *
 * If the HTMLMediaElement's <code>srcObject</code> is not set to a MediaStream,
 * this method sets it to a new MediaStream containing the {@link Track}'s
 * MediaStreamTrack; otherwise, it adds the {@link Track}'s MediaStreamTrack to
 * the existing MediaStream. Finally, if there are any other MediaStreamTracks
 * of the same kind on the MediaStream, this method removes them.

 * @method
 * @param {HTMLMediaElement} el - The HTMLMediaElement to attach to
 * @returns {HTMLMediaElement}
 * @example
 * var Video = require('twilio-video');
 * var videoElement;
 *
 * Video.createLocalVideoTrack().then(function(track) {
 *   videoElement = track.attach();
 *   document.getElementById('my-container').appendChild(videoElement);
 *   return Video.createLocalAudioTrack();
 * }).then(function(track) {
 *   track.attach(videoElement);
 * });
 *//**
 * Attach the {@link Track} to an HTMLMediaElement selected by
 * <code>document.querySelector</code>.
 *
 * If the HTMLMediaElement's <code>srcObject</code> is not set to a MediaStream, this
 * method sets it to a new MediaStream containing the {@link Track}'s
 * MediaStreamTrack; otherwise, it adds the {@link Track}'s MediaStreamTrack to
 * the existing MediaStream. Finally, if there are any other MediaStreamTracks
 * of the same kind on the MediaStream, this method removes them.
 *
 * @method
 * @param {string} selector - A query selector for the HTMLMediaElement to attach to
 * @returns {HTMLMediaElement}
 * @example
 * var Video = require('twilio-video');
 *
 * Video.createLocalAudioTrack().then(function(track) {
 *   track.attach('#my-existing-video-element-id');
 * });
 */
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
  var mediaStream = el.srcObject;
  if (!(mediaStream instanceof this._MediaStream)) {
    mediaStream = new this._MediaStream();
  }

  var getTracks = this.mediaStreamTrack.kind === 'audio'
    ? 'getAudioTracks'
    : 'getVideoTracks';

  mediaStream[getTracks]().forEach(function(mediaStreamTrack) {
    mediaStream.removeTrack(mediaStreamTrack);
  });
  mediaStream.addTrack(this.mediaStreamTrack);

  el.srcObject = mediaStream;
  el.autoplay = true;

  if (!this._attachments.has(el)) {
    this._attachments.add(el);
  }

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

/**
 * Detach a {@link Track} from all previously attached HTMLMediaElements.
 * @method
 * @returns {Array<HTMLMediaElement>} The detachedHTMLMediaElements
 * @example
 * var detachedElements = track.detach();
 * detachedElements.forEach(function(el) {
 *   el.remove();
 * });
 *//**
 * Detach a {@link Track} from a previously attached HTMLMediaElement.
 * @method
 * @param {HTMLMediaElement} el - One of the HTMLMediaElements to which the
 *    {@link Track} is attached
 * @returns {HTMLMediaElement} The detached HTMLMediaElement
 * @example
 * var videoElement = document.getElementById('my-video-element');
 * track.detach(videoElement).remove();
 *//**
 * Detach a {@link Track} from a previously attached HTMLMediaElement specified
 * by <code>document.querySelector</code>.
 * @method
 * @param {string} selector - The query selector of HTMLMediaElement to which
 *    the {@link Track} is attached
 * @returns {HTMLMediaElement} The detached HTMLMediaElement
 * @example
 * track.detach('#my-video-element').remove();
 */
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
  if (!this._attachments.has(el)) {
    return el;
  }

  var mediaStream = el.srcObject;
  if (mediaStream instanceof this._MediaStream) {
    mediaStream.removeTrack(this.mediaStreamTrack);
  }

  this._attachments.delete(el);
  return el;
};

Track.prototype._getAllAttachedElements = function _getAllAttachedElements() {
  var els = [];

  this._attachments.forEach(function(el) {
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
