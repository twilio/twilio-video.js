/* eslint new-cap:0 */
'use strict';

const TrackPublication = require('./trackpublication');
const { typeErrors: E, trackPriority } = require('../../util/constants');

/**
 * A {@link LocalTrackPublication} is a {@link LocalTrack} that has been
 * published to a {@link Room}.
 * @extends TrackPublication
 * @property {boolean} isTrackEnabled - whether the published {@link LocalTrack}
 *   is enabled
 * @property {Track.Kind} kind - kind of the published {@link LocalTrack}
 * @property {Track.Priority} priority - the publish priority of the {@link LocalTrack}
 * @property {LocalTrack} track - the {@link LocalTrack}
 * @emits LocalTrackPublication#warning
 * @emits LocalTrackPublication#warningsCleared
 */
class LocalTrackPublication extends TrackPublication {
  /**
   * Construct a {@link LocalTrackPublication}.
   * @param {LocalTrackPublicationSignaling} signaling - The corresponding
   *   {@link LocalTrackPublicationSignaling}
   * @param {LocalTrack} track - The {@link LocalTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *   that unpublishes the {@link LocalTrackPublication}
   * @param {TrackPublicationOptions} options - {@link LocalTrackPublication}
   *   options
   */
  constructor(signaling, track, unpublish, options) {
    super(track.name, signaling.sid, options);

    Object.defineProperties(this, {
      _reemitSignalingEvent: {
        value: (...args) => this.emit(
          args && args.length ? 'warning' : 'warningsCleared',
          ...args
        )
      },
      _reemitTrackEvent: {
        value: () => this.emit(this.isTrackEnabled
          ? 'trackEnabled'
          : 'trackDisabled')
      },
      _signaling: {
        value: signaling
      },
      _unpublish: {
        value: unpublish
      },
      isTrackEnabled: {
        enumerable: true,
        get() {
          return this.track.kind === 'data' ? true : this.track.isEnabled;
        }
      },
      kind: {
        enumerable: true,
        value: track.kind
      },
      priority: {
        enumerable: true,
        get() {
          return signaling.updatedPriority;
        }
      },
      track: {
        enumerable: true,
        value: track
      }
    });

    ['disabled', 'enabled'].forEach(name =>
      track.on(name, this._reemitTrackEvent));

    ['warning', 'warningsCleared'].forEach(name =>
      signaling.on(name, this._reemitSignalingEvent));
  }

  toString() {
    return `[LocalTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }

  /**
   * Update the {@link Track.Priority} of the published {@link LocalTrack}.
   * @param {Track.Priority} priority - the new {@link Track.priority}
   * @returns {this}
   * @throws {RangeError}
   */
  setPriority(priority) {
    const priorityValues = Object.values(trackPriority);
    if (!priorityValues.includes(priority)) {
      throw E.INVALID_VALUE('priority', priorityValues);
    }
    this._signaling.setPriority(priority);
    return this;
  }

  /**
   * Unpublish a {@link LocalTrackPublication}. This means that the media
   * from this {@link LocalTrackPublication} is no longer available to the
   * {@link Room}'s {@link RemoteParticipant}s.
   * @returns {this}
   */
  unpublish() {
    ['disabled', 'enabled'].forEach(name =>
      this.track.removeListener(name, this._reemitTrackEvent));

    ['warning', 'warningsCleared'].forEach(name =>
      this._signaling.removeListener(name, this._reemitSignalingEvent));

    this._unpublish(this);
    return this;
  }
}

/**
 * The published {@link LocalTrack} encountered a warning.
 * This event is only raised if you enabled warnings using <code>notifyWarnings</code> in <code>ConnectOptions</code>.
 * @event LocalTrackPublication#warning
 * @param {string} name - The warning that was raised.
 */

/**
 * The published {@link LocalTrack} cleared all warnings.
 * This event is only raised if you enabled warnings using <code>notifyWarnings</code> in <code>ConnectOptions</code>.
 * @event LocalTrackPublication#warningsCleared
 */

module.exports = LocalTrackPublication;
