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
 * @property {Set<HTMLElement>} attachments - The &lt;video&gt; elements this
 *   {@link VideoTrack} is currently attached to (managed by
 *   {@link VideoTrack#attach})
 */
function VideoTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof VideoTrack)) {
    return new VideoTrack(mediaStream, mediaStreamTrack);
  }
  Track.call(this, mediaStream, mediaStreamTrack);
  mediaStream.onaddtrack = function onaddtrack() {
    this.attachments.forEach(function(video) {
      Track.detachAudioOrVideoTrack(this, video);
      Track.attachVideo(video, mediaStream);
    }, this);
  }.bind(this);
  return this;
}

inherits(VideoTrack, Track);

/**
 * Attach the {@link VideoTrack} to a newly created &lt;video&gt; element.
 * @method
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = videoTrack.attach();
 * document.getElementById('div#remote-video-container').appendChild(remoteVideoEl);
*//**
 * Attach the {@link VideoTrack} to an existing &lt;video&gt; element.
 * @method
 * @param {HTMLElement} video - The &lt;video&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = document.getElementById('remote-video');
 * videoTrack.attach(remoteVideoEl);
*//**
 * Attach the {@link VideoTrack} to a &lt;video&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;video&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = videoTrack.attach('video#remote-video');
 */
VideoTrack.prototype.attach = Track.prototype.attach;

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
 * var remoteVideoEl = document.getElementById('remote-video');
 * videoTrack.detach(remoteVideoEl);
*//**
 * Detach the {@link VideoTrack} from a previously attached &lt;video&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;video&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedVideoEl = media.detach('div#remote-video');
 */
VideoTrack.prototype.detach = Track.prototype.detach;

/**
 * Disable the {@link VideoTrack}. This is effectively "pause".
 * @method
 * @returns {this}
 * @fires Track#disabled
 */
VideoTrack.prototype.disable = Track.prototype.disable;

/**
 * Enable the {@link VideoTrack}. This is effectively "unpause".
 * @method
 * @returns {this}
 * @fires Track#enabled
*//**
 * Enable or disable the {@link VideoTrack}. This is effectively "unpause" or
 * "pause".
 * @method
 * @param {boolean} [enabled] - Specify false to pause the {@link VideoTrack}
 * @returns {this}
 * @fires Track#disabled
 * @fires Track#enabled
 */
VideoTrack.prototype.enable = Track.prototype.enable;

module.exports = VideoTrack;
