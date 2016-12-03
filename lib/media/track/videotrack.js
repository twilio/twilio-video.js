'use strict';

var inherits = require('util').inherits;
var Track = require('./');

/**
 * Construct a {@link VideoTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link VideoTrack} is a {@link Track} representing video.
 * @extends Track
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {TrackSignaling} signaling
 * @param {{log: Log}} options
 * @property {Set<HTMLElement>} attachments - The &lt;video&gt; elements this
 *   {@link VideoTrack} is currently attached to (managed by
 *   {@link VideoTrack#attach})
 * @property {VideoTrack#Dimensions} dimensions - The {@link VideoTrack}'s {@link VideoTrack#Dimensions}
 * @fires VideoTrack#dimensionsChanged
 */
function VideoTrack(mediaStream, mediaStreamTrack, signaling, options) {
  Track.call(this, mediaStream, mediaStreamTrack, signaling, options);
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
  return track.attach(elem);
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

/**
 * Attach the {@link VideoTrack} to a newly created &lt;video&gt; element.
 * @method
 * @returns {HTMLElement}
 * @example
 * var videoEl = videoTrack.attach();
 * document.getElementById('div#video-track-container').appendChild(videoEl);
*//**
 * Attach the {@link VideoTrack} to an existing &lt;video&gt; element.
 * @method
 * @param {HTMLElement} video - The &lt;video&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var videoEl = document.getElementById('video-track');
 * videoTrack.attach(videoEl);
*//**
 * Attach the {@link VideoTrack} to a &lt;video&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;video&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var videoEl = videoTrack.attach('video#video-track');
 */
VideoTrack.prototype.attach = function attach(el) {
  el = Track.prototype.attach.call(this, el);
  el.muted = true;
  return el;
};

/**
 * Detach the {@link VideoTrack} from any and all previously attached &lt;video&gt; elements.
 * @method
 * @returns {Array<HTMLElement>}
 * @example
 * var detachedVideoEls = videoTrack.detach();
*//**
 * Detach the {@link VideoTrack} from a previously attached &lt;video&gt; element.
 * @method
 * @param {HTMLElement} video - The &lt;video&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var videoEl = document.getElementById('video-track');
 * videoTrack.detach(videoEl);
*//**
 * Detach the {@link VideoTrack} from a previously attached &lt;video&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;video&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedVideoEl = media.detach('div#video-track');
 */
VideoTrack.prototype.detach = function detach() {
  Track.prototype.detach.call(this, this._dimensionsChangedElem);
  return Track.prototype.detach.apply(this, arguments);
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
