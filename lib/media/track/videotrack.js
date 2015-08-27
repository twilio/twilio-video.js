'use strict';

var inherits = require('util').inherits;
var Track = require('./');

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
        this.emit(paused ? PAUSED : UNPAUSED, this);
      }
    }
  });
  mediaStream.onaddtrack = function onaddtrack() {
    this.attachments.forEach(function(video) {
      Track.detachAudioOrVideoTrack(this, video);
      Track.attachVideo(video, mediaStream);
    }, this);
  }.bind(this);
  return Object.freeze(this);
}

var PAUSED = VideoTrack.PAUSED = 'paused';
var UNPAUSED = VideoTrack.UNPAUSED = 'unpaused';
var VIDEO_EVENTS = VideoTrack.EVENTS = [
  PAUSED,
  UNPAUSED
];

inherits(VideoTrack, Track);

/**
 * Attach {@link VideoTrack} to a newly created &lt;video&gt; element.
 * @method
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = videoTrack.attach();
 * document.getElementById('div#remote-video-container').appendChild(remoteVideoEl);
*//**
 * Attach {@link VideoTrack} to an existing &lt;video&gt; element.
 * @method
 * @param {HTMLElement} video - The &lt;video&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = document.getElementById('remote-video');
 * videoTrack.attach(remoteVideoEl);
*//**
 * Attach {@link VideoTrack} to a &lt;video&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;video&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = videoTrack.attach('video#remote-video');
 */
VideoTrack.prototype.attach = Track.prototype.attach;

/**
 * Detach {@link AudioTrack} from any and all previously attached &lt;audio&gt; elements.
 * @method
 * @returns {Array<HTMLElement>}
 * @example
 * var detachedAudioEls = audioTrack.detach();
*//**
 * Detach {@link AudioTrack} from a previously attached &lt;audio&gt; element.
 * @method
 * @param {HTMLElement} audio - The &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = document.getElementById('remote-audio');
 * audioTrack.detach(remoteAudioEl);
*//**
 * Detach {@link AudioTrack} from a previously attached &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedAudioEl = media.detach('div#remote-audio');
 */
VideoTrack.prototype.detach = Track.prototype.detach;

module.exports = VideoTrack;
