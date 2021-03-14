'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MediaTrack = require('./mediatrack');

var _require = require('../../util/constants'),
    DEFAULT_FRAME_RATE = _require.DEFAULT_FRAME_RATE;

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
 * @property {?MediaStreamTrack} processedTrack - The source of processed video frames.
 * It is null if no VideoProcessor has been added.
 * @property {?VideoProcessor} processor - A {@link VideoProcessor} that is currently
 *   processing video frames. It is null if video frames are not being processed.
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
      _captureTimeoutId: {
        value: null,
        writable: true
      },
      _isCapturing: {
        value: false,
        writable: true
      },
      _inputFrame: {
        value: null,
        writable: true
      },
      _outputFrame: {
        value: null,
        writable: true
      },
      _unmuteHandler: {
        value: null,
        writable: true
      },
      dimensions: {
        enumerable: true,
        value: {
          width: null,
          height: null
        }
      },
      processor: {
        enumerable: true,
        value: null,
        writable: true
      }
    });

    return _ret = _this, _possibleConstructorReturn(_this, _ret);
  }

  /**
   * @private
   */


  _createClass(VideoTrack, [{
    key: '_canCaptureFrames',
    value: function _canCaptureFrames() {
      var isPublishing = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

      var canCaptureFrames = true;
      var _mediaStreamTrack = this.mediaStreamTrack,
          enabled = _mediaStreamTrack.enabled,
          readyState = _mediaStreamTrack.readyState;

      if (!enabled) {
        canCaptureFrames = false;
        this._log.debug('MediaStreamTrack is disabled');
      }
      if (readyState === 'ended') {
        canCaptureFrames = false;
        this._log.debug('MediaStreamTrack is ended');
      }
      if (!this.processor) {
        canCaptureFrames = false;
        this._log.debug('VideoProcessor not detected.');
      }
      if (!this._attachments.size && !isPublishing) {
        canCaptureFrames = false;
        this._log.debug('VideoTrack is not publishing and there is no attached element.');
      }
      return canCaptureFrames;
    }

    /**
     * @private
     */

  }, {
    key: '_captureFrames',
    value: function _captureFrames() {
      var _this2 = this;

      if (this._isCapturing) {
        return this._log.debug('Ignoring captureFrames call. Capture is already in progress');
      }
      if (!this._canCaptureFrames()) {
        this._isCapturing = false;
        return this._log.debug('Cannot capture frames. Ignoring captureFrames call.');
      }
      this._isCapturing = true;
      this._log.debug('Start capturing frames');

      var startTime = Date.now();
      var processFramePeriodMs = void 0;

      this._dummyEl.play().then(function () {
        var captureFrame = function captureFrame(cb) {
          clearTimeout(_this2._captureTimeoutId);

          var _mediaStreamTrack$get = _this2.mediaStreamTrack.getSettings(),
              _mediaStreamTrack$get2 = _mediaStreamTrack$get.frameRate,
              frameRate = _mediaStreamTrack$get2 === undefined ? DEFAULT_FRAME_RATE : _mediaStreamTrack$get2;

          var capturePeriodMs = Math.floor(1000 / frameRate);
          var delay = capturePeriodMs - processFramePeriodMs;
          if (delay < 0 || typeof processFramePeriodMs !== 'number') {
            delay = 0;
          }
          _this2._captureTimeoutId = setTimeout(cb, delay);
        };
        var process = function process() {
          if (!_this2._canCaptureFrames()) {
            _this2._isCapturing = false;
            return _this2._log.debug('Cannot capture frames. Stopping capturing frames.');
          }
          startTime = Date.now();

          var _mediaStreamTrack$get3 = _this2.mediaStreamTrack.getSettings(),
              _mediaStreamTrack$get4 = _mediaStreamTrack$get3.width,
              width = _mediaStreamTrack$get4 === undefined ? 0 : _mediaStreamTrack$get4,
              _mediaStreamTrack$get5 = _mediaStreamTrack$get3.height,
              height = _mediaStreamTrack$get5 === undefined ? 0 : _mediaStreamTrack$get5;

          _this2._inputFrame.width = width;
          _this2._inputFrame.height = height;
          _this2._inputFrame.getContext('2d').drawImage(_this2._dummyEl, 0, 0, width, height);

          var result = null;
          try {
            result = _this2.processor.processFrame(_this2._inputFrame);
          } catch (ex) {
            _this2._log.debug('Exception detected after calling processFrame.', ex);
          }
          (result instanceof Promise ? result : Promise.resolve(result)).then(function (outputFrame) {
            if (outputFrame && _this2._outputFrame) {
              _this2._outputFrame.width = width;
              _this2._outputFrame.height = height;
              _this2._outputFrame.getContext('2d').drawImage(outputFrame, 0, 0, width, height);
              _this2.processedTrack.requestFrame();
            }
          }).finally(function () {
            processFramePeriodMs = Date.now() - startTime;
            captureFrame(process);
          });
        };
        captureFrame(process);
      }).catch(function (error) {
        return _this2._log.error('Video element cannot be played', { error: error, track: _this2 });
      });
    }

    /**
     * @private
     */

  }, {
    key: '_initialize',
    value: function _initialize() {
      var _this3 = this;

      _get(VideoTrack.prototype.__proto__ || Object.getPrototypeOf(VideoTrack.prototype), '_initialize', this).call(this);
      if (this._dummyEl) {
        this._dummyEl.onloadedmetadata = function () {
          if (dimensionsChanged(_this3, _this3._dummyEl)) {
            _this3.dimensions.width = _this3._dummyEl.videoWidth;
            _this3.dimensions.height = _this3._dummyEl.videoHeight;
          }
        };
        this._dummyEl.onresize = function () {
          if (dimensionsChanged(_this3, _this3._dummyEl)) {
            _this3.dimensions.width = _this3._dummyEl.videoWidth;
            _this3.dimensions.height = _this3._dummyEl.videoHeight;
            if (_this3.isStarted) {
              _this3._log.debug('Dimensions changed:', _this3.dimensions);
              _this3.emit(VideoTrack.DIMENSIONS_CHANGED, _this3);
            }
          }
        };
      }
    }

    /**
     * @private
     */

  }, {
    key: '_restartProcessor',
    value: function _restartProcessor() {
      var processor = this.processor;
      if (processor) {
        this.removeProcessor(processor);
        this.addProcessor(processor);
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
     * Add a {@link VideoProcessor} to allow for custom processing of video frames belonging to a VideoTrack.
     * Only Chrome supports this as of now. Calling this API from a non-supported browser will result in a log warning.
     * @param {VideoProcessor} processor - The {@link VideoProcessor} to use.
     * @returns {this}
     * @example
     * class GrayScaleProcessor {
     *   constructor(percentage) {
     *     this.outputFrame = new OffscreenCanvas(0, 0);
     *     this.percentage = percentage;
     *   }
     *   processFrame(inputFrame) {
     *     this.outputFrame.width = inputFrame.width;
     *     this.outputFrame.height = inputFrame.height;
     *
     *     const context = this.outputFrame.getContext('2d');
     *     context.filter = `grayscale(${this.percentage}%)`;
     *     context.drawImage(inputFrame, 0, 0, inputFrame.width, inputFrame.height);
     *     return this.outputFrame;
     *   }
     * }
     *
     * Video.createLocalVideoTrack().then(function(videoTrack) {
     *   videoTrack.addProcessor(new GrayScaleProcessor(100));
     * });
     */

  }, {
    key: 'addProcessor',
    value: function addProcessor(processor) {
      var _this4 = this;

      if (typeof OffscreenCanvas !== 'function') {
        return this._log.warn('Adding a VideoProcessor is not supported in this browser.');
      }
      if (!processor || typeof processor.processFrame !== 'function') {
        throw new Error('Received an invalid VideoProcessor from addProcessor.');
      }
      if (this.processor) {
        throw new Error('A VideoProcessor has already been added.');
      }
      if (!this._dummyEl) {
        throw new Error('VideoTrack has not been initialized.');
      }
      this._log.debug('Adding VideoProcessor to the VideoTrack', processor);

      if (!this._unmuteHandler) {
        this._unmuteHandler = function () {
          _this4._log.debug('mediaStreamTrack unmuted');
          // NOTE(csantos): On certain scenarios where mediaStreamTrack is coming from muted to unmuted state,
          // the processedTrack doesn't unmutes automatically although enabled is already set to true.
          // This is a terminal state for the processedTrack and should be restarted. (VIDEO-4176)
          if (_this4.processedTrack.muted) {
            _this4._log.debug('mediaStreamTrack is unmuted but processedTrack is muted. Restarting processor.');
            _this4._restartProcessor();
          }
        };
        this.mediaStreamTrack.addEventListener('unmute', this._unmuteHandler);
      }

      var _mediaStreamTrack$get6 = this.mediaStreamTrack.getSettings(),
          _mediaStreamTrack$get7 = _mediaStreamTrack$get6.width,
          width = _mediaStreamTrack$get7 === undefined ? 0 : _mediaStreamTrack$get7,
          _mediaStreamTrack$get8 = _mediaStreamTrack$get6.height,
          height = _mediaStreamTrack$get8 === undefined ? 0 : _mediaStreamTrack$get8;

      this._inputFrame = new OffscreenCanvas(width, height);
      this._outputFrame = document.createElement('canvas');
      this._outputFrame.width = width;
      this._outputFrame.height = height;

      this.processedTrack = this._outputFrame.captureStream(0).getTracks()[0];
      this.processedTrack.enabled = this.mediaStreamTrack.enabled;
      this.processor = processor;

      this._updateElementsMediaStreamTrack();
      this._captureFrames();
      return this;
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
      var result = _get(VideoTrack.prototype.__proto__ || Object.getPrototypeOf(VideoTrack.prototype), 'attach', this).apply(this, arguments);
      if (this.processor) {
        this._captureFrames();
      }
      return result;
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

    /**
     * Remove the previously added {@link VideoProcessor} using `addProcessor` API.
     * @param {VideoProcessor} processor - The {@link VideoProcessor} to remove.
     * @returns {this}
     * @example
     * class GrayScaleProcessor {
     *   constructor(percentage) {
     *     this.outputFrame = new OffscreenCanvas(0, 0);
     *     this.percentage = percentage;
     *   }
     *   processFrame(inputFrame) {
     *     this.outputFrame.width = inputFrame.width;
     *     this.outputFrame.height = inputFrame.height;
     *
     *     const context = this.outputFrame.getContext('2d');
     *     context.filter = `grayscale(${this.percentage}%)`;
     *     context.drawImage(inputFrame, 0, 0, inputFrame.width, inputFrame.height);
     *     return this.outputFrame;
     *   }
     * }
     *
     * Video.createLocalVideoTrack().then(function(videoTrack) {
     *   const grayScaleProcessor = new GrayScaleProcessor(100);
     *   videoTrack.addProcessor(grayScaleProcessor);
     *   document.getElementById('remove-button').onclick = () => videoTrack.removeProcessor(grayScaleProcessor);
     * });
     */

  }, {
    key: 'removeProcessor',
    value: function removeProcessor(processor) {
      if (!processor) {
        throw new Error('Received an invalid VideoProcessor from removeProcessor.');
      }
      if (!this.processor) {
        throw new Error('No existing VideoProcessor detected.');
      }
      if (processor !== this.processor) {
        throw new Error('The provided VideoProcessor is different than the existing one.');
      }
      this._log.debug('Removing VideoProcessor from the VideoTrack', processor);
      clearTimeout(this._captureTimeoutId);
      this.mediaStreamTrack.removeEventListener('unmute', this._unmuteHandler);
      this._unmuteHandler = null;
      this._isCapturing = false;

      this.processor = null;
      this.processedTrack = null;
      this._inputFrame.getContext('2d').clearRect(0, 0, this._inputFrame.width, this._inputFrame.height);
      this._outputFrame.getContext('2d').clearRect(0, 0, this._outputFrame.width, this._outputFrame.height);
      this._inputFrame = null;
      this._outputFrame = null;

      this._updateElementsMediaStreamTrack();
      return this;
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
 * A {@link VideoProcessor} is used to process incoming video frames before
 * sending to the encoder or renderer.
 * @typedef {object} VideoProcessor
 * @property {function} processFrame - A callback to receive incoming video frames for processing.
 * Any exception raised (either synchronously or asynchronously) in `processFrame` will result in the frame being dropped.
 * Developers can drop the current frame by returning null.
 * This callback has the following signature:
 * <code>processFrame(inputFrame: OffscreenCanvas)</code><br/>
 * &nbsp;&nbsp;<code>: Promise<OffscreenCanvas | null></code><br/>
 * &nbsp;&nbsp;<code>| OffscreenCanvas | null;</code><br/>
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