'use strict';

const mixinRemoteMediaTrack = require('./remotemediatrack');
const VideoTrack = require('./videotrack');
const documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');
const { NullObserver } = require('../../util/nullobserver.js');
const Timeout = require('../../util/timeout');

const RemoteMediaVideoTrack = mixinRemoteMediaTrack(VideoTrack);
const TRACK_TURN_OF_DELAY_MS = 50;

/**
 * A {@link RemoteVideoTrack} represents a {@link VideoTrack} published to a
 * {@link Room} by a {@link RemoteParticipant}.
 * @extends VideoTrack
 * @property {boolean} isEnabled - Whether the {@link RemoteVideoTrack} is enabled
 * @property {boolean} isSwitchedOff - Whether the {@link RemoteVideoTrack} is switched off
 * @property {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
 * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteVideoTrack}
 * @emits RemoteVideoTrack#dimensionsChanged
 * @emits RemoteVideoTrack#disabled
 * @emits RemoteVideoTrack#enabled
 * @emits RemoteVideoTrack#started
 * @emits RemoteVideoTrack#switchedOff
 * @emits RemoteVideoTrack#switchedOn
 */
class RemoteVideoTrack extends RemoteMediaVideoTrack {
  /**
   * Construct a {@link RemoteVideoTrack}.
   * @param {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
   * @param {MediaTrackReceiver} mediaTrackReceiver - A video MediaStreamTrack container
   * @param {boolean} isEnabled - whether the {@link RemoteVideoTrack} is enabled
   * @param {boolean} isSwitchedOff - Whether the {@link RemoteVideoTrack} is switched off
   * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
   *  {@link Track.Priority} of the {@link RemoteVideoTrack}
   * @param {function(ClientRenderHint): void} setRenderHint - Set render hints.
   * @param {{log: Log}} options - The {@link RemoteTrack} options
   */
  constructor(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options) {
    options = Object.assign({
      clientTrackSwitchOffControl: 'auto',
      contentPreferencesMode: 'auto',
      enableDocumentVisibilityTurnOff: true,
    }, options);

    options = Object.assign({
      IntersectionObserver: typeof IntersectionObserver === 'undefined' || options.clientTrackSwitchOffControl !== 'auto'  ? NullObserver : IntersectionObserver,
      ResizeObserver: typeof ResizeObserver === 'undefined' || options.contentPreferencesMode !== 'auto' ?  NullObserver : ResizeObserver,
    }, options);

    super(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options);

    Object.defineProperties(this, {
      _enableDocumentVisibilityTurnOff: {
        value: options.enableDocumentVisibilityTurnOff === true && options.clientTrackSwitchOffControl === 'auto',
      },
      _documentVisibilityTurnOffCleanup: {
        value: null,
        writable: true
      },
      _clientTrackSwitchOffControl: {
        value: options.clientTrackSwitchOffControl,
      },
      _contentPreferencesMode: {
        value: options.contentPreferencesMode,
      },
      _invisibleElements: {
        value: new WeakSet(),
      },
      _elToPipCallbacks: {
        value: new WeakMap(),
      },
      _elToPipWindows: {
        value: new WeakMap(),
      },
      _turnOffTimer: {
        value: new Timeout(() => {
          this._setRenderHint({ enabled: false });
        }, TRACK_TURN_OF_DELAY_MS, false),
      },
      _resizeObserver: {
        value: new options.ResizeObserver(entries => {
          // NOTE(mpatwardhan): we ignore elements in _invisibleElements
          // to ensure that ResizeObserver does not end-up turning off a track when a fresh Video element is
          // attached and IntersectionObserver has not had its callback executed yet.
          const visibleElementResized = entries.find(entry => !this._invisibleElements.has(entry.target));
          if (visibleElementResized) {
            maybeUpdateDimensionHint(this);
          }
        })
      },
      _intersectionObserver: {
        value: new options.IntersectionObserver(entries => {
          let shouldSetRenderHint = false;
          entries.forEach(entry => {
            const wasVisible = !this._invisibleElements.has(entry.target);
            if (wasVisible !== entry.isIntersecting) {
              if (entry.isIntersecting) {
                this._log.debug('intersectionObserver detected: Off => On');
                this._invisibleElements.delete(entry.target);
              } else {
                this._log.debug('intersectionObserver detected: On => Off');
                this._invisibleElements.add(entry.target);
              }
              shouldSetRenderHint = true;
            }
          });
          if (shouldSetRenderHint) {
            maybeUpdateEnabledHint(this);

            // when visibility of an element changes that may cause the "biggest" element to change,
            // update dimensions as well. since dimensions are cached and de-duped at signaling layer,
            // its okay if they got  resent.
            maybeUpdateDimensionHint(this);
          }
        }, { threshold: 0.25 })
      },
    });
  }

  /**
   * @private
   */
  _start(dummyEl) {
    const result = super._start.call(this, dummyEl);
    // NOTE(mpatwardhan): after emitting started, update turn off track if not visible.
    maybeUpdateEnabledHint(this);
    return result;
  }

  /**
   * Request to switch on a {@link RemoteVideoTrack}, This method is applicable only for the group rooms and only when connected with
   * clientTrackSwitchOffControl in video bandwidth profile options set to 'manual'
   * @returns {this}
   */
  switchOn() {
    if (this._clientTrackSwitchOffControl !== 'manual') {
      throw new Error('Invalid state. You can call switchOn only when bandwidthProfile.video.clientTrackSwitchOffControl is set to "manual"');
    }
    this._setRenderHint({ enabled: true });
    return this;
  }

  /**
   * Request to switch off a {@link RemoteVideoTrack}, This method is applicable only for the group rooms and only when connected with
   * clientTrackSwitchOffControl in video bandwidth profile options set to 'manual'
   * @returns {this}
   */
  switchOff() {
    if (this._clientTrackSwitchOffControl !== 'manual') {
      throw new Error('Invalid state. You can call switchOff only when bandwidthProfile.video.clientTrackSwitchOffControl is set to "manual"');
    }
    this._setRenderHint({ enabled: false });
    return this;
  }

  /**
   * Set the {@link RemoteVideoTrack}'s content preferences. This method is applicable only for the group rooms and only when connected with
   * videoContentPreferencesMode in video bandwidth profile options set to 'manual'
   * @param {VideoContentPreferences} contentPreferences - requested preferences.
   * @returns {this}
   */
  setContentPreferences(contentPreferences) {
    if (this._contentPreferencesMode !== 'manual') {
      throw new Error('Invalid state. You can call switchOn only when bandwidthProfile.video.contentPreferencesMode is set to "manual"');
    }

    if (contentPreferences.renderDimensions) {
      this._setRenderHint({ renderDimensions: contentPreferences.renderDimensions });
    }
    return this;
  }

  _unObservePip(el) {
    const pipCallbacks = this._elToPipCallbacks.get(el);
    if (pipCallbacks) {
      el.removeEventListener('enterpictureinpicture', pipCallbacks.onEnterPip);
      el.removeEventListener('leavepictureinpicture', pipCallbacks.onLeavePip);
      this._elToPipCallbacks.delete(el);
    }
  }

  _observePip(el) {
    const pipCallbacks = this._elToPipCallbacks.get(el);
    if (!pipCallbacks) {
      const onEnterPip = event => this._onEnterPip(event, el);
      const onLeavePip = event => this._onLeavePip(event, el);
      const onResizePip = event => this._onResizePip(event, el);

      el.addEventListener('enterpictureinpicture', onEnterPip);
      el.addEventListener('leavepictureinpicture', onLeavePip);
      this._elToPipCallbacks.set(el, { onEnterPip, onLeavePip, onResizePip });
    }
  }

  _onEnterPip(event, videoEl) {
    this._log.debug('onEnterPip');
    const pipWindow = event.pictureInPictureWindow;
    this._elToPipWindows.set(videoEl, pipWindow);
    const { onResizePip } = this._elToPipCallbacks.get(videoEl);
    pipWindow.addEventListener('resize', onResizePip);
    maybeUpdateEnabledHint(this);
  }

  _onLeavePip(event, videoEl) {
    this._log.debug('onLeavePip');
    this._elToPipWindows.delete(videoEl);
    const { onResizePip } = this._elToPipCallbacks.get(videoEl);
    const pipWindow = event.pictureInPictureWindow;
    pipWindow.removeEventListener('resize', onResizePip);
    maybeUpdateEnabledHint(this);
  }

  _onResizePip() {
    maybeUpdateDimensionHint(this);
  }

  attach(el) {
    const result = super.attach(el);

    if (this._clientTrackSwitchOffControl === 'auto') {
      // start off the element as invisible. will mark it
      // visible (and update render hints) once intersection observer calls back.
      this._invisibleElements.add(result);
    }

    this._intersectionObserver.observe(result);
    this._resizeObserver.observe(result);

    if (this._enableDocumentVisibilityTurnOff) {
      this._documentVisibilityTurnOffCleanup = this._documentVisibilityTurnOffCleanup || setupDocumentVisibilityTurnOff(this);
    }

    this._observePip(result);
    return result;
  }

  detach(el) {
    const result = super.detach(el);
    const elements = Array.isArray(result) ? result : [result];
    elements.forEach(element => {
      this._intersectionObserver.unobserve(element);
      this._resizeObserver.unobserve(element);
      this._invisibleElements.delete(element);
      this._unObservePip(element);
    });

    if (this._attachments.size === 0) {
      if (this._documentVisibilityTurnOffCleanup) {
        this._documentVisibilityTurnOffCleanup();
        this._documentVisibilityTurnOffCleanup = null;
      }
    }

    maybeUpdateEnabledHint(this);
    maybeUpdateDimensionHint(this);
    return result;
  }

  /**
   * Add a {@link VideoProcessor} to allow for custom processing of video frames belonging to a VideoTrack.
   * When a Participant un-publishes and re-publishes a VideoTrack, a new RemoteVideoTrack is created and
   * any VideoProcessors attached to the previous RemoteVideoTrack would have to be re-added again.
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
   * const grayscaleProcessor = new GrayScaleProcessor(100);
   *
   * Array.from(room.participants.values()).forEach(participant => {
   *   const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
   *   remoteVideoTrack.addProcessor(grayscaleProcessor);
   * });
   */
  addProcessor() {
    return super.addProcessor.apply(this, arguments);
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
   * const grayscaleProcessor = new GrayScaleProcessor(100);
   *
   * Array.from(room.participants.values()).forEach(participant => {
   *   const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
   *   remoteVideoTrack.addProcessor(grayscaleProcessor);
   * });
   *
   * document.getElementById('remove-button').onclick = () => {
   *   Array.from(room.participants.values()).forEach(participant => {
   *     const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
   *     remoteVideoTrack.removeProcessor(grayscaleProcessor);
   *   });
   * }
   */
  removeProcessor() {
    return super.removeProcessor.apply(this, arguments);
  }

  toString() {
    return `[RemoteVideoTrack #${this._instanceId}: ${this.sid}]`;
  }

  /**
   * Update the subscribe {@link Track.Priority} of the {@link RemoteVideoTrack}.
   * @param {?Track.Priority} priority - the new subscribe {@link Track.Priority};
   *   If <code>null</code>, then the subscribe {@link Track.Priority} is cleared, which
   *   means the {@link Track.Priority} set by the publisher is now the effective priority.
   * @returns {this}
   * @throws {RangeError}
   */
  setPriority(priority) {
    return super.setPriority(priority);
  }
}

function setupDocumentVisibilityTurnOff(removeVideoTrack) {
  function onVisibilityChanged() {
    maybeUpdateEnabledHint(removeVideoTrack);
  }

  documentVisibilityMonitor.onVisibilityChange(1, onVisibilityChanged);
  return () => {
    documentVisibilityMonitor.offVisibilityChange(1, onVisibilityChanged);
  };
}

function maybeUpdateEnabledHint(remoteVideoTrack) {
  if (remoteVideoTrack._clientTrackSwitchOffControl !== 'auto') {
    return;
  }

  const visibleElements = remoteVideoTrack._getAllAttachedElements().filter(el => !remoteVideoTrack._invisibleElements.has(el));
  const pipWindows = remoteVideoTrack._getAllAttachedElements().filter(el => remoteVideoTrack._elToPipWindows.has(el));

  // even when document is invisible we may have track playing in pip window.
  const enabled = pipWindows.length > 0 || (document.visibilityState === 'visible' && visibleElements.length > 0);

  if (enabled === true) {
    remoteVideoTrack._turnOffTimer.clear();
    remoteVideoTrack._setRenderHint({ enabled: true });
  } else if (!remoteVideoTrack._turnOffTimer.isSet) {
    // set the track to be turned off after some delay.
    remoteVideoTrack._turnOffTimer.start();
  }
}

function maybeUpdateDimensionHint(remoteVideoTrack) {
  if (remoteVideoTrack._contentPreferencesMode !== 'auto') {
    return;
  }

  const visibleElements = remoteVideoTrack._getAllAttachedElements().filter(el => !remoteVideoTrack._invisibleElements.has(el));
  const pipElements = remoteVideoTrack._getAllAttachedElements().map(el => {
    const pipWindow = remoteVideoTrack._elToPipWindows.get(el);
    return pipWindow ? { clientHeight: pipWindow.height, clientWidth: pipWindow.width } : { clientHeight: 0, clientWidth: 0 };
  });
  const totalElements = visibleElements.concat(pipElements);
  if (totalElements.length > 0) {
    const [{ clientHeight, clientWidth }] = totalElements.sort((el1, el2) =>
      el2.clientHeight + el2.clientWidth - el1.clientHeight - el1.clientWidth - 1);
    const renderDimensions = { height: clientHeight, width: clientWidth };
    remoteVideoTrack._setRenderHint({ renderDimensions });
  }
}

/**
 * @typedef {object} VideoContentPreferences
 * @property {VideoTrack.Dimensions} [renderDimensions] - Render Dimensions to request for the {@link RemoteVideoTrack}.
 */

/**
 * The {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose
 *   dimensions changed
 * @event RemoteVideoTrack#dimensionsChanged
 */

/**
 * The {@link RemoteVideoTrack} was disabled, i.e. "paused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   disabled
 * @event RemoteVideoTrack#disabled
 */

/**
 * The {@link RemoteVideoTrack} was enabled, i.e. "resumed".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   enabled
 * @event RemoteVideoTrack#enabled
 */

/**
 * The {@link RemoteVideoTrack} started. This means there is enough video data
 * to begin playback.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that started
 * @event RemoteVideoTrack#started
 */

/**
 * A {@link RemoteVideoTrack} was switched off.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   switched off
 * @event RemoteVideoTrack#switchedOff
 */

/**
 * A {@link RemoteVideoTrack} was switched on.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   switched on
 * @event RemoteVideoTrack#switchedOn
 */

module.exports = RemoteVideoTrack;
