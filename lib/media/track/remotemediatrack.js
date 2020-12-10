'use strict';

const { typeErrors: E, trackPriority } = require('../../util/constants');
const { guessBrowser } = require('@twilio/webrtc/lib/util');
const documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @property {boolean} isEnabled - Whether the {@link RemoteMediaTrack} is enabled
   * @property {boolean} isSwitchedOff - Whether the {@link RemoteMediaTrack} is switched off
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
     * @param {Track.SID} sid
     * @param {MediaTrackReceiver} mediaTrackReceiver
     * @param {boolean} isEnabled
     * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
     *  {@link Track.Priority} of the {@link RemoteMediaTrack}
     * @param {{log: Log, name: ?string}} options
     */
    constructor(sid, mediaTrackReceiver, isEnabled, setPriority, options) {
      options = Object.assign({
        // NOTE(mpatwardhan): WebKit bug: 212780 sometimes causes the audio/video elements to stay paused when safari
        // regains foreground. To workaround it, when safari gains foreground - we will play any elements that were
        // playing before safari lost foreground.
        workaroundWebKitBug212780: guessBrowser() === 'safari'
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
          value: false,
          writable: true
        },
        _priority: {
          value: null,
          writable: true
        },
        _setPriority: {
          value: setPriority
        },
        isEnabled: {
          enumerable: true,
          get() {
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
        _workaroundWebKitBug212780: {
          value: options.workaroundWebKitBug212780
        },
        _workaroundWebKitBug212780Cleanup: {
          value: null,
          writable: true
        }
      });
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
     * @param {boolean} isSwitchedOff
     */
    _setSwitchedOff(isSwitchedOff) {
      if (this._isSwitchedOff !== isSwitchedOff) {
        this._isSwitchedOff = isSwitchedOff;
        this.emit(isSwitchedOff ? 'switchedOff' : 'switchedOn', this);
      }
    }

    attach(el) {
      const result = super.attach(el);
      if (this.mediaStreamTrack.enabled !== true) {
        // NOTE(mpatwardhan): we disable mediaStreamTrack when there
        // are no attachments to it (see notes below). Now that there
        // are attachments re-enable the track.
        this.mediaStreamTrack.enabled = true;
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
        this.mediaStreamTrack.enabled = false;

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

  function onVisibilityChanged() {
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
  documentVisibilityMonitor.onVisible(2, onVisibilityChanged);
  return () => {
    documentVisibilityMonitor.offVisible(2, onVisibilityChanged);
  };
}

/**
 * A {@link RemoteMediaTrack} was disabled.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   disabled
 * @event RemoteMediaTrack#disabled
 */

/**
 * A {@link RemoteMediaTrack} was enabled.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   enabled
 * @event RemoteMediaTrack#enabled
 */

/**
 * A {@link RemoteMediaTrack} was switched off.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   switched off
 * @event RemoteMediaTrack#switchedOff
 */

/**
 * A {@link RemoteMediaTrack} was switched on.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   switched on
 * @event RemoteMediaTrack#switchedOn
 */

module.exports = mixinRemoteMediaTrack;
