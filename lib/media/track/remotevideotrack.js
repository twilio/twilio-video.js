'use strict';

const { oncePerDuration } = require('../../util');
const mixinRemoteMediaTrack = require('./remotemediatrack');
const VideoTrack = require('./videotrack');

const RENDER_HINT_DURATION_MS = 200;
const RemoteMediaVideoTrack = mixinRemoteMediaTrack(VideoTrack);

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
   * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
   *  {@link Track.Priority} of the {@link RemoteVideoTrack}
   * @param {{log: Log}} options - The {@link RemoteTrack} options
   */
  constructor(sid, mediaTrackReceiver, isEnabled, setPriority, options) {
    super(sid, mediaTrackReceiver, isEnabled, setPriority, options);
    Object.defineProperties(this, {
      _intersectionObserver: {
        value: new IntersectionObserver(entries => {
          let shouldSetRenderHint = false;
          entries.forEach(entry => {
            if (entry.target.isIntersecting !== entry.isIntersecting) {
              entry.target.isIntersecting = entry.isIntersecting;
              shouldSetRenderHint = true;
            }
          });
          if (shouldSetRenderHint) {
            this._setRenderHint();
          }
        }, { threshold: 0.25 })
      },
      _renderHint: {
        get() {
          const visibleEls = this._getAllAttachedElements().filter(el => el.isIntersecting);
          const isVisible = this.isEnabled && !this._isSwitchedOff && visibleEls.length > 0;
          if (!isVisible) {
            return { height: 0, width: 0 };
          }
          const [{ clientHeight, clientWidth }] = visibleEls.sort((el1, el2) =>
            el2.clientHeight + el2.clientWidth - el1.clientHeight - el1.clientWidth - 1);
          return { height: clientHeight, width: clientWidth };
        }
      },
      _resizeObserver: {
        value: new ResizeObserver(() => this._setRenderHint())
      },
      _setRenderHint: {
        value: oncePerDuration(() => {
          this._setPriority(this._priority, this._renderHint);
        }, RENDER_HINT_DURATION_MS)
      }
    });

    this._setRenderHint();
  }

  toString() {
    return `[RemoteVideoTrack #${this._instanceId}: ${this.sid}]`;
  }

  attach() {
    const el = super.attach.apply(this, arguments);
    this._intersectionObserver.observe(el);
    this._resizeObserver.observe(el);
    return el;
  }

  detach() {
    const els = super.detach.apply(this, arguments);
    (Array.isArray(els) ? els : [els]).forEach(el => {
      this._intersectionObserver.unobserve(el);
      this._resizeObserver.unobserve(el);
    });
    this._setRenderHint();
    return els;
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
