'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var MediaTrack = require('./mediatrack');
var VideoProcessorEventObserver = require('./videoprocessoreventobserver');
var DEFAULT_FRAME_RATE = require('../../util/constants').DEFAULT_FRAME_RATE;
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
var VideoTrack = /** @class */ (function (_super) {
    __extends(VideoTrack, _super);
    /**
     * Construct a {@link VideoTrack}.
     * @param {MediaTrackTransceiver} mediaTrackTransceiver
     * @param {{log: Log}} options
     */
    function VideoTrack(mediaTrackTransceiver, options) {
        var _this = _super.call(this, mediaTrackTransceiver, options) || this;
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
            _processorEventObserver: {
                value: null,
                writable: true,
            },
            _processorOptions: {
                value: {},
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
        _this._processorEventObserver = new (options.VideoProcessorEventObserver || VideoProcessorEventObserver)(_this._log);
        return _this;
    }
    /**
     * @private
     */
    VideoTrack.prototype._checkIfCanCaptureFrames = function (isPublishing) {
        if (isPublishing === void 0) { isPublishing = false; }
        var canCaptureFrames = true;
        var message = '';
        var _a = this.mediaStreamTrack, enabled = _a.enabled, readyState = _a.readyState;
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
        return { canCaptureFrames: canCaptureFrames, message: message };
    };
    /**
     * @private
     */
    VideoTrack.prototype._captureFrames = function () {
        var _this = this;
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
        var startTime = Date.now();
        var processFramePeriodMs;
        this._dummyEl.play().then(function () {
            var captureFrame = function (cb) {
                clearTimeout(_this._captureTimeoutId);
                var _a = _this.mediaStreamTrack.getSettings().frameRate, frameRate = _a === void 0 ? DEFAULT_FRAME_RATE : _a;
                var capturePeriodMs = Math.floor(1000 / frameRate);
                var delay = capturePeriodMs - processFramePeriodMs;
                if (delay < 0 || typeof processFramePeriodMs !== 'number') {
                    delay = 0;
                }
                _this._captureTimeoutId = setTimeout(cb, delay);
            };
            var process = function () {
                var checkResult = _this._checkIfCanCaptureFrames();
                if (!checkResult.canCaptureFrames) {
                    _this._isCapturing = false;
                    _this._processorEventObserver.emit('stop', checkResult.message);
                    _this._log.debug('Cannot capture frames. Stopping capturing frames.');
                    return;
                }
                startTime = Date.now();
                var _a = _this.mediaStreamTrack.getSettings(), _b = _a.width, width = _b === void 0 ? 0 : _b, _c = _a.height, height = _c === void 0 ? 0 : _c;
                // Setting the canvas' dimension triggers a redraw.
                // Only set it if it has changed.
                if (_this._outputFrame && _this._outputFrame.width !== width) {
                    _this._outputFrame.width = width;
                    _this._outputFrame.height = height;
                }
                if (_this._inputFrame) {
                    if (_this._inputFrame.width !== width) {
                        _this._inputFrame.width = width;
                        _this._inputFrame.height = height;
                    }
                    _this._inputFrame.getContext('2d').drawImage(_this._dummyEl, 0, 0, width, height);
                }
                var result = null;
                try {
                    var input = _this._processorOptions.inputFrameBufferType === 'video' ? _this._dummyEl : _this._inputFrame;
                    result = _this.processor.processFrame(input, _this._outputFrame);
                }
                catch (ex) {
                    _this._log.debug('Exception detected after calling processFrame.', ex);
                }
                ((result instanceof Promise) ? result : Promise.resolve(result))
                    .then(function () {
                    if (_this._outputFrame) {
                        if (typeof _this.processedTrack.requestFrame === 'function') {
                            _this.processedTrack.requestFrame();
                        }
                        _this._processorEventObserver.emit('stats');
                    }
                })
                    .finally(function () {
                    processFramePeriodMs = Date.now() - startTime;
                    captureFrame(process);
                });
            };
            captureFrame(process);
        }).catch(function (error) { return _this._log.error('Video element cannot be played', { error: error, track: _this }); });
    };
    /**
     * @private
     */
    VideoTrack.prototype._initialize = function () {
        var _this = this;
        _super.prototype._initialize.call(this);
        if (this._dummyEl) {
            this._dummyEl.onloadedmetadata = function () {
                if (dimensionsChanged(_this, _this._dummyEl)) {
                    _this.dimensions.width = _this._dummyEl.videoWidth;
                    _this.dimensions.height = _this._dummyEl.videoHeight;
                }
            };
            this._dummyEl.onresize = function () {
                if (dimensionsChanged(_this, _this._dummyEl)) {
                    _this.dimensions.width = _this._dummyEl.videoWidth;
                    _this.dimensions.height = _this._dummyEl.videoHeight;
                    if (_this.isStarted) {
                        _this._log.debug('Dimensions changed:', _this.dimensions);
                        _this.emit(VideoTrack.DIMENSIONS_CHANGED, _this);
                    }
                }
            };
        }
    };
    /**
     * @private
     */
    VideoTrack.prototype._restartProcessor = function () {
        var processor = this.processor;
        if (processor) {
            var processorOptions = Object.assign({}, this._processorOptions);
            this.removeProcessor(processor);
            this.addProcessor(processor, processorOptions);
        }
    };
    /**
     * @private
     */
    VideoTrack.prototype._start = function (dummyEl) {
        this.dimensions.width = dummyEl.videoWidth;
        this.dimensions.height = dummyEl.videoHeight;
        this._log.debug('Dimensions:', this.dimensions);
        this.emit(VideoTrack.DIMENSIONS_CHANGED, this);
        return _super.prototype._start.call(this, dummyEl);
    };
    /**
     * Add a {@link VideoProcessor} to allow for custom processing of video frames belonging to a VideoTrack.
     * @param {VideoProcessor} processor - The {@link VideoProcessor} to use.
     * @param {AddProcessorOptions} [options] - {@link AddProcessorOptions} to provide.
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
    VideoTrack.prototype.addProcessor = function (processor, options) {
        var _this = this;
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
                _this._log.debug('mediaStreamTrack unmuted');
                // NOTE(csantos): On certain scenarios where mediaStreamTrack is coming from muted to unmuted state,
                // the processedTrack doesn't unmutes automatically although enabled is already set to true.
                // This is a terminal state for the processedTrack and should be restarted. (VIDEO-4176)
                if (_this.processedTrack.muted) {
                    _this._log.debug('mediaStreamTrack is unmuted but processedTrack is muted. Restarting processor.');
                    _this._restartProcessor();
                }
            };
            this.mediaStreamTrack.addEventListener('unmute', this._unmuteHandler);
        }
        this._processorOptions = options || {};
        var _a = this._processorOptions, inputFrameBufferType = _a.inputFrameBufferType, outputFrameBufferContextType = _a.outputFrameBufferContextType;
        if (typeof OffscreenCanvas === 'undefined' && inputFrameBufferType === 'offscreencanvas') {
            throw new Error('OffscreenCanvas is not supported by this browser.');
        }
        if (inputFrameBufferType && inputFrameBufferType !== 'video' && inputFrameBufferType !== 'canvas' && inputFrameBufferType !== 'offscreencanvas') {
            throw new Error("Invalid inputFrameBufferType of " + inputFrameBufferType);
        }
        if (!inputFrameBufferType) {
            inputFrameBufferType = typeof OffscreenCanvas === 'undefined' ? 'canvas' : 'offscreencanvas';
        }
        var _b = this.mediaStreamTrack.getSettings(), _c = _b.width, width = _c === void 0 ? 0 : _c, _d = _b.height, height = _d === void 0 ? 0 : _d, _e = _b.frameRate, frameRate = _e === void 0 ? DEFAULT_FRAME_RATE : _e;
        if (inputFrameBufferType === 'offscreencanvas') {
            this._inputFrame = new OffscreenCanvas(width, height);
        }
        if (inputFrameBufferType === 'canvas') {
            this._inputFrame = document.createElement('canvas');
        }
        if (this._inputFrame) {
            this._inputFrame.width = width;
            this._inputFrame.height = height;
        }
        this._outputFrame = document.createElement('canvas');
        this._outputFrame.width = width;
        this._outputFrame.height = height;
        // NOTE(csantos): Initialize the rendering context for future renders. This also ensures
        // that the correct type is used and on Firefox, it throws an exception if you try to capture
        // frames prior calling getContext https://bugzilla.mozilla.org/show_bug.cgi?id=1572422
        outputFrameBufferContextType = outputFrameBufferContextType || '2d';
        var ctx = this._outputFrame.getContext(outputFrameBufferContextType);
        if (!ctx) {
            throw new Error("Cannot get outputFrameBufferContextType: " + outputFrameBufferContextType + ".");
        }
        // NOTE(csantos): Zero FPS means we can control when to render the next frame by calling requestFrame.
        // Some browsers such as Firefox doesn't support requestFrame so we will use default, which is an undefined value.
        // This means, the browser will use the highest FPS available.
        var targetFps = typeof CanvasCaptureMediaStreamTrack !== 'undefined' && CanvasCaptureMediaStreamTrack.prototype &&
            // eslint-disable-next-line
            typeof CanvasCaptureMediaStreamTrack.prototype.requestFrame === 'function' ? 0 : undefined;
        this.processedTrack = this._outputFrame.captureStream(targetFps).getTracks()[0];
        this.processedTrack.enabled = this.mediaStreamTrack.enabled;
        this.processor = processor;
        this._processorEventObserver.emit('add', {
            processor: processor,
            captureHeight: height,
            captureWidth: width,
            inputFrameRate: frameRate,
            isRemoteVideoTrack: this.toString().includes('RemoteVideoTrack'),
            inputFrameBufferType: inputFrameBufferType,
            outputFrameBufferContextType: outputFrameBufferContextType
        });
        this._updateElementsMediaStreamTrack();
        this._captureFrames();
        return this;
    };
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
    VideoTrack.prototype.attach = function () {
        var result = _super.prototype.attach.apply(this, arguments);
        if (this.processor) {
            this._captureFrames();
        }
        return result;
    };
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
    VideoTrack.prototype.detach = function () {
        return _super.prototype.detach.apply(this, arguments);
    };
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
    VideoTrack.prototype.removeProcessor = function (processor) {
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
        this._processorOptions = {};
        this._unmuteHandler = null;
        this._isCapturing = false;
        this.processor = null;
        this.processedTrack = null;
        this._inputFrame = null;
        this._outputFrame = null;
        this._updateElementsMediaStreamTrack();
        return this;
    };
    return VideoTrack;
}(MediaTrack));
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
 * &nbsp;&nbsp;<code>inputFrameBuffer: OffscreenCanvas | HTMLCanvasElement | HTMLVideoElement,</code><br/>
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
 * Possible options to provide to {@link LocalVideoTrack#addProcessor} and {@link RemoteVideoTrack#addProcessor}.
 * @typedef {object} AddProcessorOptions
 * @property {string} [inputFrameBufferType="offscreencanvas"] - This option allows you to specify what kind of input you want to receive in your
 * Video Processor. The default is `offscreencanvas` and will fallback to a regular `canvas` if the browser does not support it.
 * Possible values include the following.
 * <br/>
 * <br/>
 * `offscreencanvas` - Your Video Processor will receive an [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
 * which is good for canvas-related processing that can be rendered off screen.
 * <br/>
 * <br/>
 * `canvas` - Your Video Processor will receive an [HTMLCanvasElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement).
 * This is recommended on browsers that doesn't support `OffscreenCanvas`, or if you need to render the frame on the screen.
 * <br/>
 * <br/>
 * `video` - Your Video Processor will receive an [HTMLVideoElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement).
 * Use this option if you are processing the frame using WebGL or if you only need to [draw](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)
 * the frame directly to your output canvas.
 * @property {string} [outputFrameBufferContextType="2d"] - The SDK needs the [context type](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)
 * that your Video Processor uses in order to properly generate the processed track. For example, if your Video Processor uses WebGL2 (`canvas.getContext('webgl2')`),
 * you should set `outputFrameBufferContextType` to `webgl2`. Or if you're using Canvas 2D processing (`canvas.getContext('2d')`),
 * you should set `outputFrameBufferContextType` to `2d`.
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
//# sourceMappingURL=videotrack.js.map