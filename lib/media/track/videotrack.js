'use strict';

const MediaTrack = require('./mediatrack');
const VideoProcessorEventObserver = require('./videoprocessoreventobserver');
const { DEFAULT_FRAME_RATE } = require('../../util/constants');

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
class VideoTrack extends MediaTrack {
  /**
   * Construct a {@link VideoTrack}.
   * @param {MediaTrackTransceiver} mediaTrackTransceiver
   * @param {{log: Log}} options
   */
  constructor(mediaTrackTransceiver, options) {
    super(mediaTrackTransceiver, options);
    Object.defineProperties(this, {
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
      _processorEventObserver: {
        value: null,
        writable: true,
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

    this._processorEventObserver = new (options.VideoProcessorEventObserver || VideoProcessorEventObserver)(this._log);

    return this;
  }

  /**
   * @private
   */
  _checkIfCanCaptureFrames(isPublishing = false) {
    let canCaptureFrames = true;
    let message = '';
    const { enabled, readyState } = this.mediaStreamTrack;

    if (!enabled) {
      canCaptureFrames = false;
      message = 'MediaStreamTrack is disabled';
    }
    if (readyState === 'ended') {
      canCaptureFrames = false;
      message = 'MediaStreamTrack is ended';
    }
    if (!this.processor) {
      canCaptureFrames = false;
      message = 'VideoProcessor not detected.';
    }
    if (!this._attachments.size && !isPublishing) {
      canCaptureFrames = false;
      message = 'VideoTrack is not publishing and there is no attached element.';
    }

    if (message) {
      this._log.debug(message);
    }
    return { canCaptureFrames, message };
  }

  /**
   * @private
   */
  _captureFrames() {
    if (this._isCapturing) {
      this._log.debug('Ignoring captureFrames call. Capture is already in progress');
      return;
    }
    if (!this._checkIfCanCaptureFrames().canCaptureFrames) {
      this._isCapturing = false;
      this._log.debug('Cannot capture frames. Ignoring captureFrames call.');
      return;
    }
    this._isCapturing = true;
    this._processorEventObserver.emit('start');
    this._log.debug('Start capturing frames');

    let startTime = Date.now();
    let processFramePeriodMs;

    this._dummyEl.play().then(() => {
      const captureFrame = cb => {
        clearTimeout(this._captureTimeoutId);
        const { frameRate = DEFAULT_FRAME_RATE } = this.mediaStreamTrack.getSettings();
        const capturePeriodMs = Math.floor(1000 / frameRate);
        let delay = capturePeriodMs - processFramePeriodMs;
        if (delay < 0 || typeof processFramePeriodMs !== 'number') {
          delay = 0;
        }
        this._captureTimeoutId = setTimeout(cb, delay);
      };
      const process = () => {
        const checkResult = this._checkIfCanCaptureFrames();
        if (!checkResult.canCaptureFrames) {
          this._isCapturing = false;
          this._processorEventObserver.emit('stop', checkResult.message);
          this._log.debug('Cannot capture frames. Stopping capturing frames.');
          return;
        }
        startTime = Date.now();

        const { width = 0, height = 0 } = this.mediaStreamTrack.getSettings();
        // Setting the canvas' dimension triggers a redraw.
        // Only set it if it has changed.
        if (this._inputFrame.width !== width) {
          this._inputFrame.width = width;
          this._inputFrame.height = height;

          if (this._outputFrame) {
            this._outputFrame.width = width;
            this._outputFrame.height = height;
          }
        }
        this._inputFrame.getContext('2d').drawImage(this._dummyEl, 0, 0, width, height);

        let result = null;
        try {
          result = this.processor.processFrame(this._inputFrame, this._outputFrame);
        } catch (ex) {
          this._log.debug('Exception detected after calling processFrame.', ex);
        }
        ((result instanceof Promise) ? result : Promise.resolve(result))
          .then(() => {
            if (this._outputFrame) {
              this.processedTrack.requestFrame();
              this._processorEventObserver.emit('stats');
            }
          })
          .finally(() => {
            processFramePeriodMs = Date.now() - startTime;
            captureFrame(process);
          });
      };
      captureFrame(process);
    }).catch(error => this._log.error('Video element cannot be played', { error, track: this }));
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
  _restartProcessor() {
    const processor = this.processor;
    if (processor) {
      this.removeProcessor(processor);
      this.addProcessor(processor);
    }
  }

  /**
   * @private
   */
  _start(dummyEl) {
    this.dimensions.width = dummyEl.videoWidth;
    this.dimensions.height = dummyEl.videoHeight;

    this._log.debug('Dimensions:', this.dimensions);
    this.emit(VideoTrack.DIMENSIONS_CHANGED, this);
    return super._start.call(this, dummyEl);
  }

  /**
   * Add a {@link VideoProcessor} to allow for custom processing of video frames belonging to a VideoTrack.
   * Only Chrome supports this as of now. Calling this API from a non-supported browser will result in a log warning.
   * @param {VideoProcessor} processor - The {@link VideoProcessor} to use.
   * @returns {this}
   * @example
   * class GrayScaleProcessor {
   *   constructor(percentage) {
   *     this.percentage = percentage;
   *   }
   *   processFrame(inputFrameBuffer, outputFrameBuffer) {
   *     const context = outputFrameBuffer.getContext('2d');
   *     context.filter = `grayscale(${this.percentage}%)`;
   *     context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
   *   }
   * }
   *
   * Video.createLocalVideoTrack().then(function(videoTrack) {
   *   videoTrack.addProcessor(new GrayScaleProcessor(100));
   * });
   */
  addProcessor(processor) {
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
      this._unmuteHandler = () => {
        this._log.debug('mediaStreamTrack unmuted');
        // NOTE(csantos): On certain scenarios where mediaStreamTrack is coming from muted to unmuted state,
        // the processedTrack doesn't unmutes automatically although enabled is already set to true.
        // This is a terminal state for the processedTrack and should be restarted. (VIDEO-4176)
        if (this.processedTrack.muted) {
          this._log.debug('mediaStreamTrack is unmuted but processedTrack is muted. Restarting processor.');
          this._restartProcessor();
        }
      };
      this.mediaStreamTrack.addEventListener('unmute', this._unmuteHandler);
    }

    const { width = 0, height = 0, frameRate = DEFAULT_FRAME_RATE } = this.mediaStreamTrack.getSettings();
    this._inputFrame = new OffscreenCanvas(width, height);
    this._outputFrame = document.createElement('canvas');
    this._outputFrame.width = width;
    this._outputFrame.height = height;

    this.processedTrack = this._outputFrame.captureStream(0).getTracks()[0];
    this.processedTrack.enabled = this.mediaStreamTrack.enabled;
    this.processor = processor;

    this._processorEventObserver.emit('add', {
      processor,
      captureHeight: height,
      captureWidth: width,
      inputFrameRate: frameRate,
      isRemoteVideoTrack: this.toString().includes('RemoteVideoTrack')
    });
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
    const result = super.attach.apply(this, arguments);
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

  /**
   * Remove the previously added {@link VideoProcessor} using `addProcessor` API.
   * @param {VideoProcessor} processor - The {@link VideoProcessor} to remove.
   * @returns {this}
   * @example
   * class GrayScaleProcessor {
   *   constructor(percentage) {
   *     this.percentage = percentage;
   *   }
   *   processFrame(inputFrameBuffer, outputFrameBuffer) {
   *     const context = outputFrameBuffer.getContext('2d');
   *     context.filter = `grayscale(${this.percentage}%)`;
   *     context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
   *   }
   * }
   *
   * Video.createLocalVideoTrack().then(function(videoTrack) {
   *   const grayScaleProcessor = new GrayScaleProcessor(100);
   *   videoTrack.addProcessor(grayScaleProcessor);
   *   document.getElementById('remove-button').onclick = () => videoTrack.removeProcessor(grayScaleProcessor);
   * });
   */
  removeProcessor(processor) {
    if (!processor) {
      throw new Error('Received an invalid VideoProcessor from removeProcessor.');
    }
    if (!this.processor) {
      throw new Error('No existing VideoProcessor detected.');
    }
    if (processor !== this.processor) {
      throw new Error('The provided VideoProcessor is different than the existing one.');
    }

    this._processorEventObserver.emit('remove');
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
 * A {@link VideoProcessor}, when added via {@link VideoTrack#addProcessor},
 * is used to process incoming video frames before
 * sending to the encoder or renderer.
 * @typedef {object} VideoProcessor
 * @property {function} processFrame - A callback to receive input and output frame buffers for processing.
 * The input frame buffer contains the original video frame which can be used for additional processing
 * such as applying filters to it. The output frame buffer is used to receive the processed video frame
 * before sending to the encoder or renderer.
 *
 * Any exception raised (either synchronously or asynchronously) in `processFrame` will result in the frame being dropped.
 * This callback has the following signature:<br/><br/>
 * <code>processFrame(</code><br/>
 * &nbsp;&nbsp;<code>inputFrameBuffer: OffscreenCanvas,</code><br/>
 * &nbsp;&nbsp;<code>outputFrameBuffer: HTMLCanvasElement</code><br/>
 * <code>): Promise&lt;void&gt; | void;</code>
 *
 * @example
 * class GrayScaleProcessor {
 *   constructor(percentage) {
 *     this.percentage = percentage;
 *   }
 *   processFrame(inputFrameBuffer, outputFrameBuffer) {
 *     const context = outputFrameBuffer.getContext('2d');
 *     context.filter = `grayscale(${this.percentage}%)`;
 *     context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
 *   }
 * }
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
