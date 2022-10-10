'use strict';

const MediaTrack = require('./mediatrack');

/**
 * An {@link AudioTrack} is a {@link Track} representing audio.
 * @extends Track
 * @property {boolean} isStarted - Whether or not the {@link AudioTrack} has
 *   started; if the {@link AudioTrack} started, there is enough audio data to
 *   begin playback
 * @property {boolean} isEnabled - Whether or not the {@link AudioTrack} is
 *   enabled; if the {@link AudioTrack} is not enabled, it is "muted"
 * @property {Track.Kind} kind - "audio"
 * @property {MediaStreamTrack} mediaStreamTrack - An audio MediaStreamTrack
 * @property {?MediaStreamTrack} processedTrack - The source of processed audio samples.
 * It is always null as audio processing is not currently supported.
 * @emits AudioTrack#disabled
 * @emits AudioTrack#enabled
 * @emits AudioTrack#started
 */
class AudioTrack extends MediaTrack {
  /**
   * Construct an {@link AudioTrack}.
   * @param {MediaTrackTransceiver} mediaTrackTransceiver
   * @param {{log: Log}} options
   */
  constructor(mediaTrackTransceiver, options) {
    super(mediaTrackTransceiver, options);
  }

  /**
   * Create an HTMLAudioElement and attach the {@link AudioTrack} to it.
   *
   * The HTMLAudioElement's <code>srcObject</code> will be set to a new
   * MediaStream containing the {@link AudioTrack}'s MediaStreamTrack.
   *
   * @returns {HTMLAudioElement} audioElement
   * @example
   * const Video = require('twilio-video');
   *
   * Video.createLocalAudioTrack().then(function(audioTrack) {
   *   const audioElement = audioTrack.attach();
   *   document.body.appendChild(audioElement);
   * });
  *//**
   * Attach the {@link AudioTrack} to an existing HTMLMediaElement. The
   * HTMLMediaElement could be an HTMLAudioElement or an HTMLVideoElement.
   *
   * If the HTMLMediaElement's <code>srcObject</code> is not set to a MediaStream,
   * this method sets it to a new MediaStream containing the {@link AudioTrack}'s
   * MediaStreamTrack; otherwise, it adds the {@link MediaTrack}'s
   * MediaStreamTrack to the existing MediaStream. Finally, if there are any other
   * MediaStreamTracks of the same kind on the MediaStream, this method removes
   * them.
   *
   * @param {HTMLMediaElement} mediaElement - The HTMLMediaElement to attach to
   * @returns {HTMLMediaElement} mediaElement
   * @example
   * const Video = require('twilio-video');
   *
   * const videoElement = document.createElement('video');
   * document.body.appendChild(videoElement);
   *
   * Video.createLocalAudioTrack().then(function(audioTrack) {
   *   audioTrack.attach(videoElement);
   * });
  *//**
   * Attach the {@link AudioTrack} to an HTMLMediaElement selected by
   * <code>document.querySelector</code>. The HTMLMediaElement could be an
   * HTMLAudioElement or an HTMLVideoElement.
   *
   * If the HTMLMediaElement's <code>srcObject</code> is not set to a MediaStream,
   * this method sets it to a new MediaStream containing the {@link AudioTrack}'s
   * MediaStreamTrack; otherwise, it adds the {@link AudioTrack}'s
   * MediaStreamTrack to the existing MediaStream. Finally, if there are any other
   * MediaStreamTracks of the same kind on the MediaStream, this method removes
   * them.
   *
   * @param {string} selector - A query selector for the HTMLMediaElement to
   *   attach to
   * @returns {HTMLMediaElement} mediaElement
   * @example
   * const Video = require('twilio-video');
   *
   * const videoElement = document.createElement('video');
   * videoElement.id = 'my-video-element';
   * document.body.appendChild(videoElement);
   *
   * Video.createLocalAudioTrack().then(function(track) {
   *   track.attach('#my-video-element');
   * });
   */
  attach() {
    return super.attach.apply(this, arguments);
  }

  /**
   * Detach the {@link AudioTrack} from all previously attached HTMLMediaElements.
   * @returns {Array<HTMLMediaElement>} mediaElements
   * @example
   * const mediaElements = audioTrack.detach();
   * mediaElements.forEach(mediaElement => mediaElement.remove());
  *//**
   * Detach the {@link AudioTrack} from a previously attached HTMLMediaElement.
   * @param {HTMLMediaElement} mediaElement - One of the HTMLMediaElements to
   *   which the {@link AudioTrack} is attached
   * @returns {HTMLMediaElement} mediaElement
   * @example
   * const videoElement = document.getElementById('my-video-element');
   * audioTrack.detach(videoElement).remove();
  *//**
   * Detach the {@link AudioTrack} from a previously attached HTMLMediaElement
   *   specified by <code>document.querySelector</code>.
   * @param {string} selector - The query selector of HTMLMediaElement to which
   *    the {@link AudioTrack} is attached
   * @returns {HTMLMediaElement} mediaElement
   * @example
   * audioTrack.detach('#my-video-element').remove();
   */
  detach() {
    return super.detach.apply(this, arguments);
  }
}

/**
 * The {@link AudioTrack} was disabled, i.e. "muted".
 * @param {AudioTrack} track - The {@link AudioTrack} that was disabled
 * @event AudioTrack#disabled
 */

/**
 * The {@link AudioTrack} was enabled, i.e. "unmuted".
 * @param {AudioTrack} track - The {@link AudioTrack} that was enabled
 * @event AudioTrack#enabled
 */

/**
 * The {@link AudioTrack} started. This means there is enough audio data to
 * begin playback.
 * @param {AudioTrack} track - The {@link AudioTrack} that started
 * @event AudioTrack#started
 */

module.exports = AudioTrack;
