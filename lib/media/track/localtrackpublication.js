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

    track.on('disabled', this._reemitTrackEvent);
    track.on('enabled', this._reemitTrackEvent);
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
    this.track.removeListener('disabled', this._reemitTrackEvent);
    this.track.removeListener('enabled', this._reemitTrackEvent);
    this._unpublish(this);
    return this;
  }
}

module.exports = LocalTrackPublication;
