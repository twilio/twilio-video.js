'use strict';

var inherits = require('util').inherits;
var Track = require('./');

/**
 * Construct an {@link AudioTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc An {@link AudioTrack} is a {@link Track} representing audio.
 * @param {MediaStream} mediaStream
 * @param {MediaSTreamTrack} mediaStreamTrack
 * @property {boolean} muted - Whether or not this {@link AudioTrack} is muted
 *   or not; set this value to mute and unmute the {@link AudioTrack}
 * @property {Set<HTMLElement>} attachments - The &lt;audio&gt; elements this
 *   {@link AudioTrack} is currently attached to (managed by
 *   {@link AudioTrack#attach})
 * @augments Track
 */
function AudioTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof AudioTrack)) {
    return new AudioTrack(mediaStream, mediaStreamTrack);
  }
  Track.call(this, mediaStream, mediaStreamTrack);
  /* istanbul ignore next */
  Object.defineProperties(this, {
    'muted': {
      enumerable: true,
      get: function() {
        return !mediaStreamTrack.enabled;
      },
      set: function(muted) {
        mediaStreamTrack.enabled = !muted;
        this.emit(muted ? MUTED : UNMUTED, this);
      }
    }
  });
  return Object.freeze(this);
}

var MUTED = AudioTrack.MUTED = 'muted';
var UNMUTED = AudioTrack.MUTED = 'unmuted';
var AUDIO_EVENTS = AudioTrack.EVENTS = [
  MUTED,
  UNMUTED
];

inherits(AudioTrack, Track);

/**
 * Attach {@link AudioTrack} to a newly created &lt;audio&gt; element.
 * @method
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = audioTrack.attach();
 * document.getElementById('div#remote-audio-container').appendChild(remoteAudioEl);
*//**
 * Attach {@link AudioTrack} to an existing &lt;audio&gt; element.
 * @method
 * @param {HTMLElement} audio - The &lt;audio&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = document.getElementById('remote-audio');
 * audioTrack.attach(remoteAudioEl);
*//**
 * Attach {@link AudioTrack} to a &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;audio&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = audioTrack.attach('audio#remote-audio');
 */
AudioTrack.prototype.attach = Track.prototype.attach;

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
AudioTrack.prototype.detach = Track.prototype.detach;

module.exports = AudioTrack;
