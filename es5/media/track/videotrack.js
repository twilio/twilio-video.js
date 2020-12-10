'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MediaTrack = require('./mediatrack');

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

var VideoTrack = function (_MediaTrack) {
  _inherits(VideoTrack, _MediaTrack);

  /**
   * Construct a {@link VideoTrack}.
   * @param {MediaTrackTransceiver} mediaTrackTransceiver
   * @param {{log: Log}} options
   */
  function VideoTrack(mediaTrackTransceiver, options) {
    var _ret;

    _classCallCheck(this, VideoTrack);

    var _this = _possibleConstructorReturn(this, (VideoTrack.__proto__ || Object.getPrototypeOf(VideoTrack)).call(this, mediaTrackTransceiver, options));

    Object.defineProperties(_this, {
      dimensions: {
        enumerable: true,
        value: {
          width: null,
          height: null
        }
      }
    });
    return _ret = _this, _possibleConstructorReturn(_this, _ret);
  }

  /**
   * @private
   */


  _createClass(VideoTrack, [{
    key: '_initialize',
    value: function _initialize() {
      var _this2 = this;

      _get(VideoTrack.prototype.__proto__ || Object.getPrototypeOf(VideoTrack.prototype), '_initialize', this).call(this);
      if (this._dummyEl) {
        this._dummyEl.onloadedmetadata = function () {
          if (dimensionsChanged(_this2, _this2._dummyEl)) {
            _this2.dimensions.width = _this2._dummyEl.videoWidth;
            _this2.dimensions.height = _this2._dummyEl.videoHeight;
          }
        };
        this._dummyEl.onresize = function () {
          if (dimensionsChanged(_this2, _this2._dummyEl)) {
            _this2.dimensions.width = _this2._dummyEl.videoWidth;
            _this2.dimensions.height = _this2._dummyEl.videoHeight;
            if (_this2.isStarted) {
              _this2._log.debug('Dimensions changed:', _this2.dimensions);
              _this2.emit(VideoTrack.DIMENSIONS_CHANGED, _this2);
            }
          }
        };
      }
    }

    /**
     * @private
     */

  }, {
    key: '_start',
    value: function _start(dummyEl) {
      this.dimensions.width = dummyEl.videoWidth;
      this.dimensions.height = dummyEl.videoHeight;

      this._log.debug('Dimensions:', this.dimensions);
      return _get(VideoTrack.prototype.__proto__ || Object.getPrototypeOf(VideoTrack.prototype), '_start', this).call(this, dummyEl);
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
    */ /**
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
       */ /**
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

  }, {
    key: 'attach',
    value: function attach() {
      return _get(VideoTrack.prototype.__proto__ || Object.getPrototypeOf(VideoTrack.prototype), 'attach', this).apply(this, arguments);
    }

    /**
     * Detach the {@link VideoTrack} from all previously attached HTMLMediaElements.
     * @returns {Array<HTMLMediaElement>} mediaElements
     * @example
     * const mediaElements = videoTrack.detach();
     * mediaElements.forEach(mediaElement => mediaElement.remove());
    */ /**
       * Detach the {@link VideoTrack} from a previously attached HTMLMediaElement.
       * @param {HTMLMediaElement} mediaElement - One of the HTMLMediaElements to
       *   which the {@link VideoTrack} is attached
       * @returns {HTMLMediaElement} mediaElement
       * @example
       * const videoElement = document.getElementById('my-video-element');
       * videoTrack.detach(videoElement).remove();
       */ /**
          * Detach the {@link VideoTrack} from a previously attached HTMLMediaElement
          *   specified by <code>document.querySelector</code>.
          * @param {string} selector - The query selector of HTMLMediaElement to which
          *    the {@link VideoTrack} is attached
          * @returns {HTMLMediaElement} mediaElement
          * @example
          * videoTrack.detach('#my-video-element').remove();
          */

  }, {
    key: 'detach',
    value: function detach() {
      return _get(VideoTrack.prototype.__proto__ || Object.getPrototypeOf(VideoTrack.prototype), 'detach', this).apply(this, arguments);
    }
  }]);

  return VideoTrack;
}(MediaTrack);

VideoTrack.DIMENSIONS_CHANGED = 'dimensionsChanged';

function dimensionsChanged(track, elem) {
  return track.dimensions.width !== elem.videoWidth || track.dimensions.height !== elem.videoHeight;
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