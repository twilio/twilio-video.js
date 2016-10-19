'use strict';

var inherits = require('util').inherits;
var Track = require('./');

/**
 * Construct an {@link AudioTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc An {@link AudioTrack} is a {@link Track} representing audio.
 * @extends Track
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {TrackSignaling} signaling
 * @param {{log: Log}} options
 * @property {Set<HTMLElement>} attachments - The &lt;audio&gt; elements this
 *   {@link AudioTrack} is currently attached to (managed by
 *   {@link AudioTrack#attach})
 */
function AudioTrack(mediaStream, mediaStreamTrack, signaling, options) {
  Track.call(this, mediaStream, mediaStreamTrack, signaling, options);
}

inherits(AudioTrack, Track);

AudioTrack.prototype.toString = function toString() {
  return '[AudioTrack #' + this._instanceId + ': ' + this.id + ']';
};

/**
 * Attach the {@link AudioTrack} to a newly created &lt;audio&gt; element.
 * @method
 * @returns {HTMLElement}
 * @example
 * var audioEl = audioTrack.attach();
 * document.getElementById('div#audio-track-container').appendChild(audioEl);
*//**
 * Attach the {@link AudioTrack} to an existing &lt;audio&gt; element.
 * @method
 * @param {HTMLElement} audio - The &lt;audio&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var audioEl = document.getElementById('audio-track');
 * audioTrack.attach(audioEl);
*//**
 * Attach the {@link AudioTrack} to a &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;audio&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var audioEl = audioTrack.attach('audio#audio-track');
 */
AudioTrack.prototype.attach = Track.prototype.attach;

/**
 * Detach the {@link AudioTrack} from any and all previously attached &lt;audio&gt; elements.
 * @method
 * @returns {Array<HTMLElement>}
 * @example
 * var detachedAudioEls = audioTrack.detach();
*//**
 * Detach the {@link AudioTrack} from a previously attached &lt;audio&gt; element.
 * @method
 * @param {HTMLElement} audio - The &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var audioEl = document.getElementById('audio-track');
 * audioTrack.detach(audioEl);
*//**
 * Detach the {@link AudioTrack} from a previously attached &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedAudioEl = media.detach('div#audio-track');
 */
AudioTrack.prototype.detach = Track.prototype.detach;

module.exports = AudioTrack;
