'use strict';

const { deprecateEvents } = require('../../util');
const { typeErrors: E, trackPriority, trackSwitchOffReason } = require('../../util/constants');
const { guessBrowser, isIOSChrome } = require('../../webrtc/util');
const documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @property {boolean} isEnabled - <code>Deprecated: Use (.isSwitchedOff && .switchOffReason === "disabled-by-publisher") instead</code>
   *   Whether the {@link RemoteAudioTrack} is enabled
   * @property {boolean} isSwitchedOff - Whether the {@link RemoteMediaTrack} is switched off
   * @property {?TrackSwitchOffReason} switchOffReason - The reason for the {@link RemoteMediaTrack} being switched off;
   *   If switched on, it is set to <code>null</code>; The {@link RemoteMediaTrack} is initially switched off with this
   *   property set to <code>disabled-by-subscriber</code>
   * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
   * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteMediaTrack}
   * @emits RemoteMediaTrack#disabled
   * @emits RemoteMediaTrack#enabled
   * @emits RemoteMediaTrack#switchedOff
   * @emits RemoteMediaTrack#switchedOn
   */
  return class RemoteMediaTrack extends AudioOrVideoTrack {
    /**
     * Construct a {@link RemoteMediaTrack}.
     * @param {Track.Kind} kind
     * @param {Track.SID} sid
     * @param {?MediaTrackReceiver} mediaTrackReceiver
     * @param {boolean} isEnabled
     * @param {boolean} isSwitchedOff
     * @param {?string} switchOffReason
     * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
     *  {@link Track.Priority} of the {@link RemoteMediaTrack}
     * @param {function(ClientRenderHint): void} setRenderHint - Set render hints.
     * @param {{log: Log, name: string}} options
     */
    constructor(kind, sid, mediaTrackReceiver, isEnabled, isSwitchedOff, switchOffReason, setPriority, setRenderHint, options) {
      options = Object.assign({
        // NOTE(mpatwardhan): WebKit bug: 212780 sometimes causes the audio/video elements to stay paused when safari
        // regains foreground. To workaround it, when safari gains foreground - we will play any elements that were
        // playing before safari lost foreground.
        workaroundWebKitBug212780: (guessBrowser() === 'safari' || isIOSChrome())
          && typeof document === 'object'
          && typeof document.addEventListener === 'function'
          && typeof document.visibilityState === 'string'
      }, options);

      super(mediaTrackReceiver, options);

      Object.defineProperties(this, {
        _isEnabled: {
          value: isEnabled,
          writable: true
        },
        _isSwitchedOff: {
          value: isSwitchedOff,
          writable: true
        },
        _priority: {
          value: null,
          writable: true
        },
        _setPriority: {
          value: setPriority
        },
        _setRenderHint: {
          value: renderHint => {
            this._log.debug('updating render hint:', renderHint);
            setRenderHint(renderHint);
          }
        },
        _switchOffReason: {
          value: switchOffReason,
          writable: true
        },
        _workaroundWebKitBug212780: {
          value: options.workaroundWebKitBug212780
        },
        _workaroundWebKitBug212780Cleanup: {
          value: null,
          writable: true
        },
        isEnabled: {
          enumerable: true,
          get() {
            this._log.deprecated('.isEnabled is deprecated and scheduled for removal. '
             + 'The RemoteMediaTrack is can be considered disabled if .isSwitchedOff is '
             + 'set to true and .switchOffReason is set to "disabled-by-publisher".');
            return this._isEnabled;
          }
        },
        isSwitchedOff: {
          enumerable: true,
          get() {
            return this._isSwitchedOff;
          }
        },
        priority: {
          enumerable: true,
          get() {
            return this._priority;
          }
        },
        sid: {
          enumerable: true,
          value: sid
        },
        switchOffReason: {
          enumerable: true,
          get() {
            return trackSwitchOffReason[this._switchOffReason] || null;
          }
        }
      });

      const { _log: log, constructor: { name } } = this;
      deprecateEvents(name, this, new Map([
        ['disabled', 'switchedOff (.switchOffReason === "disabled-by-publisher")'],
        ['enabled', 'switchedOn']
      ]), log);
    }

    /**
     * Update the subscribe {@link Track.Priority} of the {@link RemoteMediaTrack}.
     * @param {?Track.Priority} priority - the new subscribe {@link Track.Priority};
     *   If <code>null</code>, then the subscribe {@link Track.Priority} is cleared, which
     *   means the {@link Track.Priority} set by the publisher is now the effective priority.
     * @returns {this}
     * @throws {RangeError}
     */
    setPriority(priority) {
      const priorityValues = [null, ...Object.values(trackPriority)];
      if (!priorityValues.includes(priority)) {
        // eslint-disable-next-line new-cap
        throw E.INVALID_VALUE('priority', priorityValues);
      }
      if (this._priority !== priority) {
        this._priority = priority;
        this._setPriority(priority);
      }
      return this;
    }

    /**
     * @private
     * @param {boolean} isEnabled
     */
    _setEnabled(isEnabled) {
      if (this._isEnabled !== isEnabled) {
        this._isEnabled = isEnabled;
        this.emit(this._isEnabled ? 'enabled' : 'disabled', this);
      }
    }

    /**
     * @private
     * @param {?MediaTrackReceiver} mediaTrackReceiver
     */
    _setMediaTrackReceiver(mediaTrackReceiver) {
      if (this._mediaTrackTransceiver !== mediaTrackReceiver) {
        this._mediaTrackTransceiver = mediaTrackReceiver;
        this._initialize();
        this._updateElementsMediaStreamTrack();
      }
    }

    /**
     * @private
     * @param {boolean} isSwitchedOff
     * @param {?string} [switchOffReason=null]
     */
    _setSwitchedOff(isSwitchedOff, switchOffReason = null) {
      if (this._isSwitchedOff !== isSwitchedOff || this._switchOffReason !== switchOffReason) {
        this._isSwitchedOff = isSwitchedOff;
        this._switchOffReason = switchOffReason;
        this.emit(isSwitchedOff ? 'switchedOff' : 'switchedOn', this, ...(isSwitchedOff ? [this.switchOffReason] : []));
      }
    }

    attach(el) {
      const result = super.attach(el);
      if (this.mediaStreamTrack && this.mediaStreamTrack.enabled !== true) {
        // NOTE(mpatwardhan): we disable mediaStreamTrack when there
        // are no attachments to it (see notes below). Now that there
        // are attachments re-enable the track.
        this.mediaStreamTrack.enabled = true;
        if (this.processedTrack) {
          this.processedTrack.enabled = true;
        }

        // NOTE(csantos): since remote tracks disables/enables the mediaStreamTrack,
        // captureFrames stops along with it. We need to start it again after re-enabling.
        // See attach/detach methods in this class and in VideoTrack class.
        if (this.processor) {
          this._captureFrames();
        }
      }
      if (this._workaroundWebKitBug212780) {
        this._workaroundWebKitBug212780Cleanup = this._workaroundWebKitBug212780Cleanup
          || playIfPausedWhileInBackground(this);
      }

      return result;
    }

    detach(el) {
      const result = super.detach(el);
      if (this._attachments.size === 0) {
        // NOTE(mpatwardhan): chrome continues playing webrtc audio
        // track even after audio element is removed from the DOM.
        // https://bugs.chromium.org/p/chromium/issues/detail?id=749928
        // to workaround: here disable the track when
        // there are no elements attached to it.
        if (this.mediaStreamTrack) {
          this.mediaStreamTrack.enabled = false;
        }
        if (this.processedTrack) {
          this.processedTrack.enabled = false;
        }
        if (this._workaroundWebKitBug212780Cleanup) {
          // unhook visibility change
          this._workaroundWebKitBug212780Cleanup();
          this._workaroundWebKitBug212780Cleanup = null;
        }
      }
      return result;
    }
  };
}

function playIfPausedWhileInBackground(remoteMediaTrack) {
  const { _log: log, kind } = remoteMediaTrack;

  function onVisibilityChanged(isVisible) {
    if (!isVisible) {
      return;
    }
    remoteMediaTrack._attachments.forEach(el => {
      const shim = remoteMediaTrack._elShims.get(el);
      const isInadvertentlyPaused = el.paused && shim && !shim.pausedIntentionally();
      if (isInadvertentlyPaused) {
        log.info(`Playing inadvertently paused <${kind}> element`);
        log.debug('Element:', el);
        log.debug('RemoteMediaTrack:', remoteMediaTrack);
        el.play().then(() => {
          log.info(`Successfully played inadvertently paused <${kind}> element`);
          log.debug('Element:', el);
          log.debug('RemoteMediaTrack:', remoteMediaTrack);
        }).catch(err => {
          log.warn(`Error while playing inadvertently paused <${kind}> element:`, { err, el, remoteMediaTrack });
        });
      }
    });
  }

  // NOTE(mpatwardhan): listen for document visibility callback on phase 2.
  // this ensures that any LocalMediaTrack's restart (which listen on phase 1) gets executed
  // first. This order is important because we `play` tracks in the callback, and
  // play can fail on safari if audio is not being captured.
  documentVisibilityMonitor.onVisibilityChange(2, onVisibilityChanged);
  return () => {
    documentVisibilityMonitor.offVisibilityChange(2, onVisibilityChanged);
  };
}

/**
 * A {@link RemoteMediaTrack} was disabled.
 * @deprecated Use <a href="#event:switchedOff"><code>switchedOff</code></a> (<code>.switchOffReason === "disabled-by-publisher"</code>) instead
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   disabled
 * @event RemoteMediaTrack#disabled
 */

/**
 * A {@link RemoteMediaTrack} was enabled.
 * @deprecated Use <a href="#event:switchedOn"><code>switchedOn</code></a> instead
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   enabled
 * @event RemoteMediaTrack#enabled
 */

/**
 * A {@link RemoteMediaTrack} was switched off. The media server stops sending media for the
 * {@link RemoteMediaTrack} until it is switched back on. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>true</code> and <code>switchOffReason</code> is
 * set to a {@link TrackSwitchOffReason}. Also, the <code>mediaStreamTrack</code> property is
 * set to <code>null</code>.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   switched off
 * @param {?TrackSwitchOffReason} switchOffReason - The reason the {@link RemoteMediaTrack}
 *   was switched off
 * @event RemoteMediaTrack#switchedOff
 */

/**
 * A {@link RemoteMediaTrack} was switched on. The media server starts sending media for the
 * {@link RemoteMediaTrack} until it is switched off. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>false</code> and <code>switchOffReason</code>
 * is set to <code>null</code>. Also, the <code>mediaStreamTrack</code> property is set to a
 * MediaStreamTrack that is the source of the {@link RemoteMediaTrack}'s media.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   switched on
 * @event RemoteMediaTrack#switchedOn
 */

/**
 * A {@link ClientRenderHint} object specifies track dimensions and /enabled disable state.
 * This state will be used by the server(SFU) to determine bandwidth allocation for the track,
 * and turn it on or off as needed.
 * @typedef {object} ClientRenderHint
 * @property {boolean} [enabled] - track is enabled or disabled. defaults to disabled.
 * @property {VideoTrack.Dimensions} [renderDimensions] - Optional parameter to specify the desired
 *   render dimensions of {@link RemoteVideoTrack}s. This property must be specified if enabled=true
 */

module.exports = mixinRemoteMediaTrack;
