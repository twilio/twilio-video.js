'use strict';

const MediaTrack = require('./mediatrack');

/**
 * A {@link VideoTrack} is a {@link Track} representing video.
 * @extends Track
 * @property {boolean} isStarted - Whether or not the {@link VideoTrack} has
 *   started; if the {@link VideoTrack} started, there is enough video data to
 *   begin playback
 * @property {boolean} isEnabled - Whether or not the {@link VideoTrack} is
 *   enabled; if the {@link VideoTrack} is not enabled, it is "paused"
 * @property {VideoTrack.Dimensions} dimensions - The {@link VideoTrack}'s
 *   {@link VideoTrack.Dimensions}
 * @property {Track.Kind} kind - "video"
 * @property {MediaStreamTrack} mediaStreamTrack - A video MediaStreamTrack
 * @emits VideoTrack#dimensionsChanged
 * @emits VideoTrack#disabled
 * @emits VideoTrack#enabled
 * @emits VideoTrack#started
 */
class VideoTrack extends MediaTrack {
  /**
   * Construct a {@link VideoTrack}.
   * @param {MediaTrackTransceiver} mediaTrackTransceiver
   * @param {{log: Log}} options
   */
  constructor(mediaTrackTransceiver, options) {
    super(mediaTrackTransceiver, options);
    Object.defineProperties(this, {
      dimensions: {
        enumerable: true,
        value: {
          width: null,
          height: null
        }
      }
    });
    return this;
  }

  /**
   * @private
   */
  _initialize() {
    super._initialize();
    if (this._dummyEl) {
      this._dummyEl.onloadedmetadata = () => {
        if (dimensionsChanged(this, this._dummyEl)) {
          this.dimensions.width = this._dummyEl.videoWidth;
          this.dimensions.height = this._dummyEl.videoHeight;
        }
      };
      this._dummyEl.onresize = () => {
        if (dimensionsChanged(this, this._dummyEl)) {
          this.dimensions.width = this._dummyEl.videoWidth;
          this.dimensions.height = this._dummyEl.videoHeight;
          if (this.isStarted) {
            this._log.debug('Dimensions changed:', this.dimensions);
            this.emit(VideoTrack.DIMENSIONS_CHANGED, this);
          }
        }
      };
    }
  }

  /**
   * @private
   */
  _start(dummyEl) {
    this.dimensions.width = dummyEl.videoWidth;
    this.dimensions.height = dummyEl.videoHeight;

    this._log.debug('Dimensions:', this.dimensions);
    return super._start.call(this, dummyEl);
  }

  /**
   * Create an HTMLVideoElement and attach the {@link VideoTrack} to it.
   *
   * The HTMLVideoElement's <code>srcObject</code> will be set to a new
   * MediaStream containing the {@link VideoTrack}'s MediaStreamTrack.
   *
   * @returns {HTMLVideoElement} videoElement
   * @example
   * const Video = require('twilio-video');
   *
   * Video.createLocalVideoTrack().then(function(videoTrack) {
   *   const videoElement = videoTrack.attach();
   *   document.body.appendChild(videoElement);
   * });
  *//**
   * Attach the {@link VideoTrack} to an existing HTMLMediaElement. The
   * HTMLMediaElement could be an HTMLAudioElement or an HTMLVideoElement.
   *
   * If the HTMLMediaElement's <code>srcObject</code> is not set to a MediaStream,
   * this method sets it to a new MediaStream containing the {@link VideoTrack}'s
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
   * Video.createLocalVideoTrack().then(function(videoTrack) {
   *   videoTrack.attach(videoElement);
   * });
  *//**
   * Attach the {@link VideoTrack} to an HTMLMediaElement selected by
   * <code>document.querySelector</code>. The HTMLMediaElement could be an
   * HTMLAudioElement or an HTMLVideoElement.
   *
   * If the HTMLMediaElement's <code>srcObject</code> is not set to a MediaStream,
   * this method sets it to a new MediaStream containing the {@link VideoTrack}'s
   * MediaStreamTrack; otherwise, it adds the {@link VideoTrack}'s
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
   * Video.createLocalVideoTrack().then(function(track) {
   *   track.attach('#my-video-element');
   * });
   */
  attach() {
    return super.attach.apply(this, arguments);
  }

  /**
   * Detach the {@link VideoTrack} from all previously attached HTMLMediaElements.
   * @returns {Array<HTMLMediaElement>} mediaElements
   * @example
   * const mediaElements = videoTrack.detach();
   * mediaElements.forEach(mediaElement => mediaElement.remove());
  *//**
   * Detach the {@link VideoTrack} from a previously attached HTMLMediaElement.
   * @param {HTMLMediaElement} mediaElement - One of the HTMLMediaElements to
   *   which the {@link VideoTrack} is attached
   * @returns {HTMLMediaElement} mediaElement
   * @example
   * const videoElement = document.getElementById('my-video-element');
   * videoTrack.detach(videoElement).remove();
  *//**
   * Detach the {@link VideoTrack} from a previously attached HTMLMediaElement
   *   specified by <code>document.querySelector</code>.
   * @param {string} selector - The query selector of HTMLMediaElement to which
   *    the {@link VideoTrack} is attached
   * @returns {HTMLMediaElement} mediaElement
   * @example
   * videoTrack.detach('#my-video-element').remove();
   */
  detach() {
    return super.detach.apply(this, arguments);
  }
}

VideoTrack.DIMENSIONS_CHANGED = 'dimensionsChanged';

function dimensionsChanged(track, elem) {
  return track.dimensions.width !== elem.videoWidth
    || track.dimensions.height !== elem.videoHeight;
}

/**
 * A {@link VideoTrack}'s width and height.
 * @typedef {object} VideoTrack.Dimensions
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

/**
 * The {@link VideoTrack} was disabled, i.e. "paused".
 * @param {VideoTrack} track - The {@link VideoTrack} that was disabled
 * @event VideoTrack#disabled
 */

/**
 * The {@link VideoTrack} was enabled, i.e. "unpaused".
 * @param {VideoTrack} track - The {@link VideoTrack} that was enabled
 * @event VideoTrack#enabled
 */

/**
 * The {@link VideoTrack} started. This means there is enough video data to
 * begin playback.
 * @param {VideoTrack} track - The {@link VideoTrack} that started
 * @event VideoTrack#started
 */

module.exports = VideoTrack;
