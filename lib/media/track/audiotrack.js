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
 * @property {Set<HTMLElement>} attachments - The &lt;audio&gt; elements this
 *   {@link AudioTrack} is currently attached to (managed by
 *   {@link AudioTrack#attach})
 */
function AudioTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof AudioTrack)) {
    return new AudioTrack(mediaStream, mediaStreamTrack);
  }
  Track.call(this, mediaStream, mediaStreamTrack);
  return this;
}

inherits(AudioTrack, Track);

/**
 * Attach the {@link AudioTrack} to a newly created &lt;audio&gt; element.
 * @method
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = audioTrack.attach();
 * document.getElementById('div#remote-audio-container').appendChild(remoteAudioEl);
*//**
 * Attach the {@link AudioTrack} to an existing &lt;audio&gt; element.
 * @method
 * @param {HTMLElement} audio - The &lt;audio&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = document.getElementById('remote-audio');
 * audioTrack.attach(remoteAudioEl);
*//**
 * Attach the {@link AudioTrack} to a &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;audio&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = audioTrack.attach('audio#remote-audio');
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
 * var remoteAudioEl = document.getElementById('remote-audio');
 * audioTrack.detach(remoteAudioEl);
*//**
 * Detach the {@link AudioTrack} from a previously attached &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedAudioEl = media.detach('div#remote-audio');
 */
AudioTrack.prototype.detach = Track.prototype.detach;

/**
 * Disable the {@link AudioTrack}. This is effectively "mute".
 * @method
 * @returns {this}
 * @fires Track#disabled
 */
AudioTrack.prototype.disable = Track.prototype.disable;

/**
 * Enable the {@link AudioTrack}. This is effectively "unmute".
 * @method
 * @returns {this}
 * @fires Track#enabled
*//**
 * Enable or disable the {@link AudioTrack}. This is effectively "unmute" or
 * "mute".
 * @method
 * @param {boolean} [enabled] - Specify false to mute the {@link AudioTrack}
 * @returns {this}
 * @fires Track#disabled
 * @fires Track#enabled
 */
AudioTrack.prototype.enable = Track.prototype.enable;

module.exports = AudioTrack;
