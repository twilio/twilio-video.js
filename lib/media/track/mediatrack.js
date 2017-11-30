'use strict';

var MediaStream = require('@twilio/webrtc').MediaStream;
var inherits = require('util').inherits;
var Track = require('./');

/**
 * Construct a {@link MediaTrack}.
 * @class
 * @classdesc A {@link MediaTrack} represents audio or video that can be sent to
 *   or received from a {@link Room}.
 * @param {MediaTrackTransceiver} mediaTrackTransceiver
 * @param {{log: Log}} options
 * @property {Track.ID} id - This {@link Track}'s ID
 * @property {boolean} isStarted - Whether or not the {@link MediaTrack} has
 *   started
 * @property {boolean} isEnabled - Whether or not the {@link MediaTrack} is
 *   enabled (i.e., whether it is paused or muted)
 * @property {Track.Kind} kind - The kind of the underlying
 *   MediaStreamTrack, "audio" or "video"
 * @property {MediaStreamTrack} mediaStreamTrack - The underlying
 *   MediaStreamTrack
 * @fires MediaTrack#disabled
 * @fires MediaTrack#enabled
 * @fires MediaTrack#started
 */
function MediaTrack(mediaTrackTransceiver, options) {
  Track.call(this, mediaTrackTransceiver.id, mediaTrackTransceiver.kind, options);
  var isStarted = false;

  options = Object.assign({
    MediaStream: MediaStream
  }, options);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _attachments: {
      value: new Set()
    },
    _isStarted: {
      get: function() {
        return isStarted;
      },
      set: function(_isStarted) {
        isStarted = _isStarted;
      }
    },
    _MediaStream: {
      value: options.MediaStream
    },
    isStarted: {
      get: function() {
        return isStarted;
      }
    },
    mediaStreamTrack: {
      enumerable: true,
      value: mediaTrackTransceiver.track
    }
  });

  this._initialize();
}

MediaTrack.DISABLED = 'disabled';
MediaTrack.ENABLED = 'enabled';
var STARTED = MediaTrack.STARTED = 'started';

inherits(MediaTrack, Track);

MediaTrack.prototype._start = function _start() {
  this._log.debug('Started');
  this._isStarted = true;
  if (this._dummyEl) {
    this._detachElement(this._dummyEl);
    this._dummyEl.oncanplay = null;
  }
  this.emit(STARTED, this);
};

MediaTrack.prototype._initialize = function _initialize() {
  var self = this;

  this._log.debug('Initializing');
  this._dummyEl = this._createElement();

  this.mediaStreamTrack.addEventListener('ended', function onended() {
    self._end();
    self.mediaStreamTrack.removeEventListener('ended', onended);
  });

  if (this._dummyEl) {
    this._dummyEl.muted = true;
    this._dummyEl.oncanplay = this._start.bind(this, this._dummyEl);
    this._attach(this._dummyEl);
    this._attachments.delete(this._dummyEl);
  }
};

MediaTrack.prototype._end = function _end() {
  this._log.debug('Ended');
  if (this._dummyEl) {
    this._detachElement(this._dummyEl);
    this._dummyEl.oncanplay = null;
  }
};

MediaTrack.prototype.attach = function attach(el) {
  if (typeof el === 'string') {
    el = this._selectElement(el);
  } else if (!el) {
    el = this._createElement();
  }
  this._log.debug('Attempting to attach to element:', el);
  el = this._attach(el);

  return el;
};

MediaTrack.prototype._attach = function _attach(el) {
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

  // NOTE(mroberts): Although we don't necessarily need to reset `srcObject`,
  // we've been doing it here for a while, and it turns out it has allowed us
  // to sidestep the following issue:
  //
  //   https://bugs.chromium.org/p/chromium/issues/detail?id=720258
  //
  el.srcObject = mediaStream;
  el.autoplay = true;
  el.playsInline = true;

  if (!this._attachments.has(el)) {
    this._attachments.add(el);
  }

  return el;
};

MediaTrack.prototype._selectElement = function _selectElement(selector) {
  var el = document.querySelector(selector);

  if (!el) {
    throw new Error('Selector matched no element: ' + selector);
  }

  return el;
};

MediaTrack.prototype._createElement = function _createElement() {
  return typeof document !== 'undefined'
    ? document.createElement(this.kind)
    : null;
};

MediaTrack.prototype.detach = function _detach(el) {
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

MediaTrack.prototype._detachElements = function _detachElements(elements) {
  return elements.map(this._detachElement.bind(this));
};

MediaTrack.prototype._detachElement = function _detachElement(el) {
  if (!this._attachments.has(el)) {
    return el;
  }

  var mediaStream = el.srcObject;
  if (mediaStream instanceof this._MediaStream) {
    mediaStream.removeTrack(this.mediaStreamTrack);
    // NOTE(mroberts): It's as if, in Chrome and Safari, the <audio> element's
    // `srcObject` setter is taking a "snapshot" of the MediaStream's
    // MediaStreamTracks in order to playback; hence, calls to `removeTrack`
    // don't take effect unless you set the <audio> element's `srcObject` again.
    //
    //   https://bugs.chromium.org/p/chromium/issues/detail?id=749928
    //
    el.srcObject = mediaStream;
  }

  this._attachments.delete(el);
  return el;
};

MediaTrack.prototype._getAllAttachedElements = function _getAllAttachedElements() {
  var els = [];

  this._attachments.forEach(function(el) {
    els.push(el);
  });

  return els;
};

module.exports = MediaTrack;
