'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MediaTrack = require('./mediatrack');

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
 * @emits AudioTrack#disabled
 * @emits AudioTrack#enabled
 * @emits AudioTrack#started
 */

var AudioTrack = function (_MediaTrack) {
  _inherits(AudioTrack, _MediaTrack);

  /**
   * Construct an {@link AudioTrack}.
   * @param {MediaTrackTransceiver} mediaTrackTransceiver
   * @param {{log: Log}} options
   */
  function AudioTrack(mediaTrackTransceiver, options) {
    _classCallCheck(this, AudioTrack);

    return _possibleConstructorReturn(this, (AudioTrack.__proto__ || Object.getPrototypeOf(AudioTrack)).call(this, mediaTrackTransceiver, options));
  }

  /**
   * @private
   */


  _createClass(AudioTrack, [{
    key: '_start',
    value: function _start() {
      _get(AudioTrack.prototype.__proto__ || Object.getPrototypeOf(AudioTrack.prototype), '_start', this).call(this);
      if (this._dummyEl) {
        this._detachElement(this._dummyEl);
      }
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
    */ /**
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
       */ /**
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

  }, {
    key: 'attach',
    value: function attach() {
      return _get(AudioTrack.prototype.__proto__ || Object.getPrototypeOf(AudioTrack.prototype), 'attach', this).apply(this, arguments);
    }

    /**
     * Detach the {@link AudioTrack} from all previously attached HTMLMediaElements.
     * @returns {Array<HTMLMediaElement>} mediaElements
     * @example
     * const mediaElements = audioTrack.detach();
     * mediaElements.forEach(mediaElement => mediaElement.remove());
    */ /**
       * Detach the {@link AudioTrack} from a previously attached HTMLMediaElement.
       * @param {HTMLMediaElement} mediaElement - One of the HTMLMediaElements to
       *   which the {@link AudioTrack} is attached
       * @returns {HTMLMediaElement} mediaElement
       * @example
       * const videoElement = document.getElementById('my-video-element');
       * audioTrack.detach(videoElement).remove();
       */ /**
          * Detach the {@link AudioTrack} from a previously attached HTMLMediaElement
          *   specified by <code>document.querySelector</code>.
          * @param {string} selector - The query selector of HTMLMediaElement to which
          *    the {@link AudioTrack} is attached
          * @returns {HTMLMediaElement} mediaElement
          * @example
          * audioTrack.detach('#my-video-element').remove();
          */

  }, {
    key: 'detach',
    value: function detach() {
      return _get(AudioTrack.prototype.__proto__ || Object.getPrototypeOf(AudioTrack.prototype), 'detach', this).apply(this, arguments);
    }
  }]);

  return AudioTrack;
}(MediaTrack);

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