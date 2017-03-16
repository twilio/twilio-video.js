'use strict';

var inherits = require('util').inherits;
var Track = require('./');

/**
 * Construct a {@link VideoTrack} from MediaStreamTrack.
 * @class
 * @classdesc A {@link VideoTrack} is a {@link Track} representing video.
 * @extends Track
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {TrackSignaling} signaling
 * @param {{log: Log}} options
 * @property {VideoTrack#Dimensions} dimensions - The {@link VideoTrack}'s {@link VideoTrack#Dimensions}
 * @fires VideoTrack#dimensionsChanged
 */
function VideoTrack(mediaStreamTrack, signaling, options) {
  Track.call(this, mediaStreamTrack, signaling, options);
  Object.defineProperties(this, {
    dimensions: {
      enumerable: true,
      value: {
        width: null,
        height: null
      }
    }
  });
  Object.defineProperty(this, '_dimensionsChangedElem', {
    value: emitDimensionsChangedEvents(this)
  });
  return this;
}

var DIMENSIONS_CHANGED = VideoTrack.DIMENSIONS_CHANGED = 'dimensionsChanged';

function emitDimensionsChangedEvents(track) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var elem = document.createElement(track.kind);
  elem.muted = true;
  elem.onloadedmetadata = function onloadedmetadata() {
    if (dimensionsChanged(track, elem)) {
      track.dimensions.width = elem.videoWidth;
      track.dimensions.height = elem.videoHeight;
    }
  };
  elem.onresize = function onresize() {
    if (dimensionsChanged(track, elem)) {
      track.dimensions.width = elem.videoWidth;
      track.dimensions.height = elem.videoHeight;
      if (track.isStarted) {
        track._log.debug('Dimensions changed:', track.dimensions);
        track.emit(DIMENSIONS_CHANGED, track);
      }
    }
  };
  elem = track.attach(elem);
  track._attachments.delete(elem);
  return elem;
}

function dimensionsChanged(track, elem) {
  return track.dimensions.width !== elem.videoWidth
    || track.dimensions.height !== elem.videoHeight;
}

inherits(VideoTrack, Track);

VideoTrack.prototype.toString = function toString() {
  return '[VideoTrack #' + this._instanceId + ': ' + this.id + ']';
};

VideoTrack.prototype._start = function _start(dummyEl) {
  this.dimensions.width = dummyEl.videoWidth;
  this.dimensions.height = dummyEl.videoHeight;

  this._log.debug('Dimensions:', this.dimensions);
  return Track.prototype._start.call(this, dummyEl);
};

VideoTrack.prototype.attach = function attach(el) {
  el = Track.prototype.attach.call(this, el);
  el.muted = true;
  return el;
};

/**
 * A {@link VideoTrack}'s width and height.
 * @typedef {object} VideoTrack#Dimensions
 * @property {?number} width - The {@link VideoTrack}'s width or null if the
 *   {@link VideoTrack} has not yet started
 * @property {?number} height - The {@link VideoTrack}'s height or null if the
 *   {@link VideoTrack} has not yet started
 */

/**
 * The {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event VideoTrack#dimensionsChanged
 */

module.exports = VideoTrack;
