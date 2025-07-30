'use strict';

const { isIOS } = require('../../util/browserdetection');
const detectSilentVideo = require('../../util/detectsilentvideo');
const mixinLocalMediaTrack = require('./localmediatrack');
const VideoTrack = require('./videotrack');

const LocalMediaVideoTrack = mixinLocalMediaTrack(VideoTrack);

/**
 * A {@link LocalVideoTrack} is a {@link VideoTrack} representing video that
 * your {@link LocalParticipant} can publish to a {@link Room}. It can be
 * enabled and disabled with {@link LocalVideoTrack#enable} and
 * {@link LocalVideoTrack#disable} or stopped completely with
 * {@link LocalVideoTrack#stop}.
 * @extends VideoTrack
 * @property {Track.ID} id - The {@link LocalVideoTrack}'s ID
 * @property {boolean} isMuted - Whether or not the video source has stopped sending frames to the
 *   {@link LocalVideoTrack}; This can happen when the camera is taken over by another application,
 *   mainly on mobile devices; When this property toggles, then <code>muted</code> and <code>unmuted</code>
 *   events are fired appropriately
 * @property {boolean} isStopped - Whether or not the {@link LocalVideoTrack} is
 *   stopped
 * @emits LocalVideoTrack#disabled
 * @emits LocalVideoTrack#enabled
 * @emits LocalVideoTrack#muted
 * @emits LocalVideoTrack#started
 * @emits LocalVideoTrack#stopped
 * @emits LocalVideoTrack#unmuted
 */
class LocalVideoTrack extends LocalMediaVideoTrack {
  /**
   * Construct a {@link LocalVideoTrack} from a MediaStreamTrack.
   * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
   * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
   */
  constructor(mediaStreamTrack, options) {
    options = Object.assign({
      workaroundSilentLocalVideo: isIOS()
        && typeof document !== 'undefined'
        && typeof document.createElement === 'function'
    }, options);

    super(mediaStreamTrack, options);

    Object.defineProperties(this, {
      _workaroundSilentLocalVideo: {
        value: options.workaroundSilentLocalVideo
          ? workaroundSilentLocalVideo
          : null
      },
      _workaroundSilentLocalVideoCleanup: {
        value: null,
        writable: true
      },
      _pipIntersectionObserver: {
        value: null,
        writable: true
      }
    });

    // NOTE(mmalavalli): In iOS Safari, we work around a bug where local video
    // MediaStreamTracks are silent (even though they are enabled, live and unmuted)
    // after accepting/rejecting a phone call.
    if (this._workaroundSilentLocalVideo) {
      this._workaroundSilentLocalVideoCleanup = this._workaroundSilentLocalVideo(this, document);
    }
  }

  toString() {
    return `[LocalVideoTrack #${this._instanceId}: ${this.id}]`;
  }

  /**
   * Handle document PiP enter event - set up intersection observer for PiP-specific visibility tracking
   *
   * NOTE(lrivas): This is only created if we are in document PiP mode and should be considered deprecated
   * if Chrome's native PiP fixes the issue in the future.
   * @private
   */
  _onDocumentPipEnter() {
    this._log.debug('LocalVideoTrack: Setting up PiP intersection observer');
    this._setupPipIntersectionObserver();
  }

  /**
   * Handle document PiP exit event - clean up intersection observer
   * NOTE(lrivas): This is only created if we are in document PiP mode and should be considered deprecated
   * if Chrome's native PiP fixes the issue in the future.
   * @private
   */
  _onDocumentPipExit() {
    this._log.debug('LocalVideoTrack: Cleaning up PiP intersection observer');
    this._cleanupPipIntersectionObserver();
  }

  /**
   * Set up an IntersectionObserver to track visibility of elements attached in document PiP.
   * This ensures that videos in PiP play when visible.
   *
   * NOTE(lrivas): This is only created if we are in document PiP mode and should be considered deprecated
   * if Chrome's native PiP fixes the issue in the future.
   * @private
   */
  _setupPipIntersectionObserver() {
    if (!this._pipIntersectionObserver && this._documentPipWindow) {
      this._log.debug('LocalVideoTrack: Creating PiP intersection observer');

      this._pipIntersectionObserver = new IntersectionObserver(entries => {
        const hasVisibleElements = entries.some(entry => entry.isIntersecting);

        if (hasVisibleElements) {
          this._log.debug('LocalVideoTrack: Element visible in PiP, ensuring videos are playing');
          VideoTrack._ensureDocumentPipVideosPlaying(this);
        }
      }, { threshold: 0.25 });

      this._attachments.forEach(el => {
        this._log.debug('LocalVideoTrack: Observing element for PiP visibility');
        this._pipIntersectionObserver.observe(el);
      });
    }
  }

  /**
   * Clean up PiP-specific intersection observer
   *
   * NOTE(lrivas): This is only created if we are in document PiP mode and should be considered deprecated
   * if Chrome's native PiP fixes the issue in the future.
   * @private
   */
  _cleanupPipIntersectionObserver() {
    if (this._pipIntersectionObserver) {
      this._log.debug('LocalVideoTrack: Disconnecting PiP intersection observer');
      this._pipIntersectionObserver.disconnect();
      this._pipIntersectionObserver = null;
    }
  }

  /**
   * Attach the {@link LocalVideoTrack} to an HTMLMediaElement.
   * @returns {HTMLMediaElement} mediaElement
   */
  attach() {
    const result = super.attach.apply(this, arguments);

    // If we're in document PiP, new elements should be observed for visibility
    if (this._pipIntersectionObserver) {
      this._log.debug('LocalVideoTrack: Observing newly attached element for PiP visibility');
      this._pipIntersectionObserver.observe(result);
    }

    return result;
  }

  /**
   * Detach the {@link LocalVideoTrack} from HTMLMediaElement(s).
   * @returns {HTMLMediaElement|Array<HTMLMediaElement>} mediaElement(s)
   */
  detach() {
    const result = super.detach.apply(this, arguments);
    const elements = Array.isArray(result) ? result : [result];

    // Stop observing detached elements if we're in document PiP
    if (this._pipIntersectionObserver) {
      elements.forEach(el => {
        this._log.debug('LocalVideoTrack: Unobserving detached element from PiP visibility');
        this._pipIntersectionObserver.unobserve(el);
      });
    }

    return result;
  }

  /**
   * @private
   */
  _checkIfCanCaptureFrames() {
    return super._checkIfCanCaptureFrames.call(this, this._trackSender.isPublishing);
  }

  /**
   * @private
   */
  _end() {
    return super._end.apply(this, arguments);
  }

  /**
   * @param {boolean} useProcessed - Whether to use the processed track or the unprocessed track.
   * @returns {Promise<void>}
   * @private
   */
  _setSenderMediaStreamTrack(useProcessed) {
    const unprocessedTrack = this.mediaStreamTrack;
    const mediaStreamTrack = useProcessed ? this.processedTrack : unprocessedTrack;

    return this._trackSender.setMediaStreamTrack(mediaStreamTrack)
      .catch(error => this._log.warn(
        'setMediaStreamTrack failed on LocalVideoTrack RTCRtpSender', { error, mediaStreamTrack }))
      .then(() => {
        this._unprocessedTrack = useProcessed ? unprocessedTrack : null;
      });
  }

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
   * const localVideoTrack = Array.from(room.localParticipant.videoTracks.values())[0].track;
   * localVideoTrack.addProcessor(new GrayScaleProcessor(100));
   */
  addProcessor() {
    this._log.debug('Adding VideoProcessor to the LocalVideoTrack');
    const result = super.addProcessor.apply(this, arguments);

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
   *     this.percentage = percentage;
   *   }
   *   processFrame(inputFrameBuffer, outputFrameBuffer) {
   *     const context = outputFrameBuffer.getContext('2d');
   *     context.filter = `grayscale(${this.percentage}%)`;
   *     context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
   *   }
   * }
   *
   * const localVideoTrack = Array.from(room.localParticipant.videoTracks.values())[0].track;
   * const grayScaleProcessor = new GrayScaleProcessor(100);
   * localVideoTrack.addProcessor(grayScaleProcessor);
   *
   * document.getElementById('remove-button').onclick = () => localVideoTrack.removeProcessor(grayScaleProcessor);
   */
  removeProcessor() {
    this._log.debug('Removing VideoProcessor from the LocalVideoTrack');
    const result = super.removeProcessor.apply(this, arguments);

    this._log.debug('Updating LocalVideoTrack\'s MediaStreamTrack with the original MediaStreamTrack');
    this._setSenderMediaStreamTrack()
      .then(() => this._updateElementsMediaStreamTrack());

    return result;
  }

  /**
   * Disable the {@link LocalVideoTrack}. This is equivalent to pausing a video source.
   * If a {@link VideoProcessor} is added, then <code>processedTrack</code> is also disabled.
   * @returns {this}
   * @fires VideoTrack#disabled
   */
  disable() {
    const result = super.disable.apply(this, arguments);
    if (this.processedTrack) {
      this.processedTrack.enabled = false;
    }
    return result;
  }

  /**
   * Enable the {@link LocalVideoTrack}. This is equivalent to unpausing the video source.
   * If a {@link VideoProcessor} is added, then <code>processedTrack</code> is also enabled.
   * @returns {this}
   * @fires VideoTrack#enabled
  *//**
   * Enable or disable the {@link LocalVideoTrack}. This is equivalent to unpausing or pausing
   * the video source respectively. If a {@link VideoProcessor} is added, then <code>processedTrack</code>
   * is also enabled or disabled.
   * @param {boolean} [enabled] - Specify false to disable the
   *   {@link LocalVideoTrack}
   * @returns {this}
   * @fires VideoTrack#disabled
   * @fires VideoTrack#enabled
   */
  enable(enabled = true) {
    const result = super.enable.apply(this, arguments);
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
   *
   * If a {@link VideoProcessor} is applied to this track, it will be automatically
   * restarted after the new MediaStreamTrack is created to ensure proper processing
   * continues with the new video source.
   *
   * @param {MediaTrackConstraints} [constraints] - The optional <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints" target="_blank">MediaTrackConstraints</a>
   *   for restarting the {@link LocalVideoTrack}; If not specified, then the current MediaTrackConstraints
   *   will be used; If <code>{}</code> (empty object) is specified, then the default MediaTrackConstraints
   *   will be used
   * @returns {Promise<void>} Resolves when the restart is complete, including any processor restart operations.
   *   Rejects with a TypeError if the {@link LocalVideoTrack} was not created
   *   using one of <code>createLocalVideoTrack</code>, <code>createLocalTracks</code> or <code>connect</code>;
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
  restart() {
    if (this._workaroundSilentLocalVideoCleanup) {
      this._workaroundSilentLocalVideoCleanup();
      this._workaroundSilentLocalVideoCleanup = null;
    }

    let promise = super.restart.apply(this, arguments);

    if (this.processor) {
      promise = promise.then(() => this._restartProcessor());
    }

    if (this._workaroundSilentLocalVideo) {
      promise.finally(() => {
        this._workaroundSilentLocalVideoCleanup = this._workaroundSilentLocalVideo(this, document);
      });
    }
    return promise;
  }

  /**
   * Restarts the video processor by removing and re-adding it with the same options,
   * then updates the sender to use the newly processed MediaStreamTrack.
   *
   * This operations are done synchronously to ensure the processor is restarted before the
   * sender is updated to avoid race conditions.
   *
   * @returns {Promise<void>}
   * @private
   */
  _restartProcessor() {
    const processor = this.processor;
    const processorOptions = Object.assign({}, this._processorOptions);
    // Local video track's removeProcessor and addProcessor call setSenderMediaStreamTrack async,
    // but we need to wait for that operation to finish for a successful restart.
    // So we call the parent's removeProcessor and addProcessor, then setSenderMediaStreamTrack right after.
    super.removeProcessor.apply(this, [processor]);
    super.addProcessor.apply(this, [processor, processorOptions]);
    return this._setSenderMediaStreamTrack(true);
  }

  /**
   * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
   * {@link LocalVideoTrack}, you should unpublish it after stopping.
   * @returns {this}
   * @fires LocalVideoTrack#stopped
   */
  stop() {
    if (this._workaroundSilentLocalVideoCleanup) {
      this._workaroundSilentLocalVideoCleanup();
      this._workaroundSilentLocalVideoCleanup = null;
    }

    // Clean up PiP intersection observer when stopping
    this._cleanupPipIntersectionObserver();

    return super.stop.apply(this, arguments);
  }
}

/**
 * Work around a bug where local video MediaStreamTracks are silent (even though
 * they are enabled, live and unmuted) after accepting/rejecting a phone call.
 * @private
 * @param {LocalVideoTrack} localVideoTrack
 * @param {HTMLDocument} doc
 * @returns {function} Cleans up listeners attached by the workaround
 */
function workaroundSilentLocalVideo(localVideoTrack, doc) {
  const { _log: log } = localVideoTrack;
  let { _dummyEl: el, mediaStreamTrack } = localVideoTrack;

  function onUnmute() {
    if (!localVideoTrack.isEnabled) {
      return;
    }
    log.info('Unmuted, checking silence');

    // The dummy element is paused, so play it and then detect silence.
    el.play().then(() => detectSilentVideo(el, doc)).then(isSilent => {
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
    }).catch(error => {
      log.warn('Failed to detect silence and restart:', error);
    }).finally(() => {
      // If silent frames were not detected, then pause the dummy element again,
      // if there is no processed track.
      el = localVideoTrack._dummyEl;
      if (el && !el.paused && !localVideoTrack.processedTrack) {
        el.pause();
      }

      // Reset the unmute handler.
      mediaStreamTrack.removeEventListener('unmute', onUnmute);
      mediaStreamTrack = localVideoTrack.mediaStreamTrack;
      if (mediaStreamTrack.addEventListener) {
        mediaStreamTrack.addEventListener('unmute', onUnmute);
      } else {
        mediaStreamTrack.onunmute = onUnmute;
      }
    });
  }

  // Set the unmute handler.
  if (mediaStreamTrack.addEventListener) {
    mediaStreamTrack.addEventListener('unmute', onUnmute);
  } else {
    mediaStreamTrack.onunmute = onUnmute;
  }

  return () => {
    if (mediaStreamTrack.removeEventListener) {
      mediaStreamTrack.removeEventListener('unmute', onUnmute);
    } else {
      mediaStreamTrack.onunmute = null;
    }
  };
}

/**
 * The {@link LocalVideoTrack} was disabled, i.e. the video source was paused by the user.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was
 *   disabled
 * @event LocalVideoTrack#disabled
 */

/**
 * The {@link LocalVideoTrack} was enabled, i.e. the video source was unpaused by the user.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was enabled
 * @event LocalVideoTrack#enabled
 */

/**
 * The {@link LocalVideoTrack} was muted because the video source stopped sending frames, most
 * likely due to another application taking said video source, especially on mobile devices.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was muted
 * @event LocalVideoTrack#muted
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

/**
 * The {@link LocalVideoTrack} was unmuted because the video source resumed sending frames,
 * most likely due to the application that took over the said video source has released it
 * back to the application, especially on mobile devices. This event is also fired when
 * {@link LocalVideoTrack#restart} is called on a muted {@link LocalVideoTrack} with a
 * new video source.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was unmuted
 * @event LocalVideoTrack#unmuted
 */

module.exports = LocalVideoTrack;
