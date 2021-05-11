'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('@twilio/webrtc/lib/util'),
    guessBrowser = _require.guessBrowser;

var detectSilentVideo = require('../../util/detectsilentvideo');
var mixinLocalMediaTrack = require('./localmediatrack');
var VideoTrack = require('./videotrack');

var LocalMediaVideoTrack = mixinLocalMediaTrack(VideoTrack);

/**
 * A {@link LocalVideoTrack} is a {@link VideoTrack} representing video that
 * your {@link LocalParticipant} can publish to a {@link Room}. It can be
 * enabled and disabled with {@link LocalVideoTrack#enable} and
 * {@link LocalVideoTrack#disable} or stopped completely with
 * {@link LocalVideoTrack#stop}.
 * @extends VideoTrack
 * @property {Track.ID} id - The {@link LocalVideoTrack}'s ID
 * @property {boolean} isStopped - Whether or not the {@link LocalVideoTrack} is
 *   stopped
 * @emits LocalVideoTrack#disabled
 * @emits LocalVideoTrack#enabled
 * @emits LocalVideoTrack#started
 * @emits LocalVideoTrack#stopped
 */

var LocalVideoTrack = function (_LocalMediaVideoTrack) {
  _inherits(LocalVideoTrack, _LocalMediaVideoTrack);

  /**
   * Construct a {@link LocalVideoTrack} from a MediaStreamTrack.
   * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
   * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
   */
  function LocalVideoTrack(mediaStreamTrack, options) {
    _classCallCheck(this, LocalVideoTrack);

    options = Object.assign({
      workaroundSilentLocalVideo: guessBrowser() === 'safari' && typeof document !== 'undefined' && typeof document.createElement === 'function'
    }, options);

    var _this = _possibleConstructorReturn(this, (LocalVideoTrack.__proto__ || Object.getPrototypeOf(LocalVideoTrack)).call(this, mediaStreamTrack, options));

    Object.defineProperties(_this, {
      _workaroundSilentLocalVideo: {
        value: options.workaroundSilentLocalVideo ? workaroundSilentLocalVideo : null
      },
      _workaroundSilentLocalVideoCleanup: {
        value: null,
        writable: true
      }
    });

    // NOTE(mmalavalli): In iOS Safari, we work around a bug where local video
    // MediaStreamTracks are silent (even though they are enabled, live and unmuted)
    // after accepting/rejecting a phone call.
    if (_this._workaroundSilentLocalVideo) {
      _this._workaroundSilentLocalVideoCleanup = _this._workaroundSilentLocalVideo(_this, document);
    }
    return _this;
  }

  _createClass(LocalVideoTrack, [{
    key: 'toString',
    value: function toString() {
      return '[LocalVideoTrack #' + this._instanceId + ': ' + this.id + ']';
    }

    /**
     * @private
     */

  }, {
    key: '_canCaptureFrames',
    value: function _canCaptureFrames() {
      return _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), '_canCaptureFrames', this).call(this, this._trackSender.isPublishing);
    }

    /**
     * @private
     */

  }, {
    key: '_end',
    value: function _end() {
      return _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), '_end', this).apply(this, arguments);
    }

    /**
     * @private
     */

  }, {
    key: '_setSenderMediaStreamTrack',
    value: function _setSenderMediaStreamTrack(useProcessed) {
      var _this2 = this;

      var unprocessedTrack = this.mediaStreamTrack;
      var mediaStreamTrack = useProcessed ? this.processedTrack : unprocessedTrack;

      return this._trackSender.setMediaStreamTrack(mediaStreamTrack).catch(function (error) {
        return _this2._log.warn('setMediaStreamTrack failed on LocalVideoTrack RTCRtpSender', { error: error, mediaStreamTrack: mediaStreamTrack });
      }).then(function () {
        _this2._unprocessedTrack = useProcessed ? unprocessedTrack : null;
      });
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
     * const localVideoTrack = Array.from(room.localParticipant.videoTracks.values())[0].track;
     * localVideoTrack.addProcessor(new GrayScaleProcessor(100));
     */

  }, {
    key: 'addProcessor',
    value: function addProcessor() {
      this._log.debug('Adding VideoProcessor to the LocalVideoTrack');
      var result = _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), 'addProcessor', this).apply(this, arguments);

      if (!this.processedTrack) {
        return this._log.warn('Unable to add a VideoProcessor to the LocalVideoTrack');
      }

      this._log.debug('Updating LocalVideoTrack\'s MediaStreamTrack with the processed MediaStreamTrack', this.processedTrack);
      this._setSenderMediaStreamTrack(true);

      return result;
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
     * const localVideoTrack = Array.from(room.localParticipant.videoTracks.values())[0].track;
     * const grayScaleProcessor = new GrayScaleProcessor(100);
     * localVideoTrack.addProcessor(grayScaleProcessor);
     *
     * document.getElementById('remove-button').onclick = () => localVideoTrack.removeProcessor(grayScaleProcessor);
     */

  }, {
    key: 'removeProcessor',
    value: function removeProcessor() {
      var _this3 = this;

      this._log.debug('Removing VideoProcessor from the LocalVideoTrack');
      var result = _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), 'removeProcessor', this).apply(this, arguments);

      this._log.debug('Updating LocalVideoTrack\'s MediaStreamTrack with the original MediaStreamTrack');
      this._setSenderMediaStreamTrack().then(function () {
        return _this3._updateElementsMediaStreamTrack();
      });

      return result;
    }

    /**
     * Disable the {@link LocalVideoTrack}. This is effectively "pause".
     * If a {@link VideoProcessor} is added, then `processedTrack` is disabled as well.
     * @returns {this}
     * @fires VideoTrack#disabled
     */

  }, {
    key: 'disable',
    value: function disable() {
      var result = _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), 'disable', this).apply(this, arguments);
      if (this.processedTrack) {
        this.processedTrack.enabled = false;
      }
      return result;
    }

    /**
     * Enable the {@link LocalVideoTrack}. This is effectively "unpause".
     * If a {@link VideoProcessor} is added, then `processedTrack` is enabled as well.
     * @returns {this}
     * @fires VideoTrack#enabled
    */ /**
       * Enable or disable the {@link LocalVideoTrack}. This is effectively "unpause"
       * or "pause". If a {@link VideoProcessor} is added,
       * then `processedTrack` is enabled or disabled as well.
       * @param {boolean} [enabled] - Specify false to pause the
       *   {@link LocalVideoTrack}
       * @returns {this}
       * @fires VideoTrack#disabled
       * @fires VideoTrack#enabled
       */

  }, {
    key: 'enable',
    value: function enable() {
      var enabled = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

      var result = _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), 'enable', this).apply(this, arguments);
      if (this.processedTrack) {
        this.processedTrack.enabled = enabled;

        if (enabled) {
          this._captureFrames();
          this._log.debug('Updating LocalVideoTrack\'s MediaStreamTrack with the processed MediaStreamTrack', this.processedTrack);
          this._setSenderMediaStreamTrack(true);
        }
      }
      return result;
    }

    /**
     * Restart the {@link LocalVideoTrack}. This stops the existing MediaStreamTrack
     * and creates a new MediaStreamTrack. If the {@link LocalVideoTrack} is being published
     * to a {@link Room}, then all the {@link RemoteParticipant}s will start receiving media
     * from the newly created MediaStreamTrack. You can access the new MediaStreamTrack via
     * the <code>mediaStreamTrack</code> property. If you want to listen to events on
     * the MediaStreamTrack directly, please do so in the "started" event handler. Also,
     * the {@link LocalVideoTrack}'s ID is no longer guaranteed to be the same as the
     * underlying MediaStreamTrack's ID.
     * @param {MediaTrackConstraints} [constraints] - The optional <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints" target="_blank">MediaTrackConstraints</a>
     *   for restarting the {@link LocalVideoTrack}; If not specified, then the current MediaTrackConstraints
     *   will be used; If <code>{}</code> (empty object) is specified, then the default MediaTrackConstraints
     *   will be used
     * @returns {Promise<void>} Rejects with a TypeError if the {@link LocalVideoTrack} was not created
     *   using an one of <code>createLocalVideoTrack</code>, <code>createLocalTracks</code> or <code>connect</code>;
     *   Also rejects with the <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Exceptions" target="_blank">DOMException</a>
     *   raised by <code>getUserMedia</code> when it fails
     * @fires LocalVideoTrack#stopped
     * @fires LocalVideoTrack#started
     * @example
     * const { connect, createLocalVideoTrack } = require('twilio-video');
     *
     * // Create a LocalVideoTrack that captures video from the front-facing camera.
     * createLocalVideoTrack({ facingMode: 'user' }).then(function(localVideoTrack) {
     *   return connect('token', {
     *     name: 'my-cool-room',
     *     tracks: [localVideoTrack]
     *   });
     * }).then(function(room) {
     *   // Restart the LocalVideoTrack to capture video from the back-facing camera.
     *   const localVideoTrack = Array.from(room.localParticipant.videoTracks.values())[0].track;
     *   return localVideoTrack.restart({ facingMode: 'environment' });
     * });
     */

  }, {
    key: 'restart',
    value: function restart() {
      var _this4 = this;

      if (this._workaroundSilentLocalVideoCleanup) {
        this._workaroundSilentLocalVideoCleanup();
        this._workaroundSilentLocalVideoCleanup = null;
      }

      var promise = _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), 'restart', this).apply(this, arguments);
      if (this.processor) {
        promise.then(function () {
          _this4._restartProcessor();
        });
      }

      if (this._workaroundSilentLocalVideo) {
        promise.finally(function () {
          _this4._workaroundSilentLocalVideoCleanup = _this4._workaroundSilentLocalVideo(_this4, document);
        });
      }
      return promise;
    }

    /**
     * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
     * {@link LocalVideoTrack}, you should unpublish it after stopping.
     * @returns {this}
     * @fires LocalVideoTrack#stopped
     */

  }, {
    key: 'stop',
    value: function stop() {
      if (this._workaroundSilentLocalVideoCleanup) {
        this._workaroundSilentLocalVideoCleanup();
        this._workaroundSilentLocalVideoCleanup = null;
      }
      return _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), 'stop', this).apply(this, arguments);
    }
  }]);

  return LocalVideoTrack;
}(LocalMediaVideoTrack);

/**
 * Work around a bug where local video MediaStreamTracks are silent (even though
 * they are enabled, live and unmuted) after accepting/rejecting a phone call.
 * @private
 * @param {LocalVideoTrack} localVideoTrack
 * @param {HTMLDocument} doc
 * @returns {function} Cleans up listeners attached by the workaround
 */


function workaroundSilentLocalVideo(localVideoTrack, doc) {
  var log = localVideoTrack._log;
  var el = localVideoTrack._dummyEl,
      mediaStreamTrack = localVideoTrack.mediaStreamTrack;


  function onUnmute() {
    if (!localVideoTrack.isEnabled) {
      return;
    }
    log.info('Unmuted, checking silence');

    // The dummy element is paused, so play it and then detect silence.
    el.play().then(function () {
      return detectSilentVideo(el, doc);
    }).then(function (isSilent) {
      if (!isSilent) {
        log.info('Non-silent frames detected, so no need to restart');
        return;
      }
      log.warn('Silence detected, restarting');

      // NOTE(mmalavalli): If we try and restart a silent MediaStreamTrack
      // without stopping it first, then a NotReadableError is raised. Hence,
      // we stop the MediaStreamTrack here.
      localVideoTrack._stop();

      // Restart the LocalVideoTrack.
      // eslint-disable-next-line consistent-return
      return localVideoTrack._restart();
    }).catch(function (error) {
      log.warn('Failed to detect silence and restart:', error);
    }).finally(function () {
      // If silent frames were not detected, then pause the dummy element again.
      el = localVideoTrack._dummyEl;
      if (!el.paused) {
        el.pause();
      }

      // Reset the unmute handler.
      mediaStreamTrack.removeEventListener('unmute', onUnmute);
      mediaStreamTrack = localVideoTrack.mediaStreamTrack;
      mediaStreamTrack.addEventListener('unmute', onUnmute);
    });
  }

  // Set the unmute handler.
  mediaStreamTrack.addEventListener('unmute', onUnmute);

  return function () {
    mediaStreamTrack.removeEventListener('unmute', onUnmute);
  };
}

/**
 * The {@link LocalVideoTrack} was disabled, i.e. "muted".
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was
 *   disabled
 * @event LocalVideoTrack#disabled
 */

/**
 * The {@link LocalVideoTrack} was enabled, i.e. "unmuted".
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was enabled
 * @event LocalVideoTrack#enabled
 */

/**
 * The {@link LocalVideoTrack} started. This means there is enough video data
 * to begin playback.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that started
 * @event LocalVideoTrack#started
 */

/**
 * The {@link LocalVideoTrack} stopped, either because {@link LocalVideoTrack#stop}
 * or {@link LocalVideoTrack#restart} was called or because the underlying
 * MediaStreamTrack ended.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that stopped
 * @event LocalVideoTrack#stopped
 */

module.exports = LocalVideoTrack;