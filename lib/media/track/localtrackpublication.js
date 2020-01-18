'use strict';

const TrackPublication = require('./trackpublication');

/**
 * A {@link LocalTrackPublication} is a {@link LocalTrack} that has been
 * published to a {@link Room}.
 * @extends TrackPublication
 * @property {Track.Kind} kind - kind of the published {@link LocalTrack}
 * @property {LocalTrack} track - the {@link LocalTrack}
 */
class LocalTrackPublication extends TrackPublication {
  /**
   * Construct a {@link LocalTrackPublication}.
   * @param {Track.SID} trackSid - SID assigned to the published {@link LocalTrack}
   * @param {LocalTrack} track - the {@link LocalTrack}
   * @param {function(LocalTrackPublication): void} unpublish - The callback
   *   that unpublishes the {@link LocalTrackPublication}
   * @param {TrackPublicationOptions} options - {@link LocalTrackPublication}
   *   options
   */
  constructor(trackSid, track, unpublish, options) {
    super(track.name, trackSid, options);

    Object.defineProperties(this, {
      _reemitTrackEvent: {
        value: () => this.emit(this.isTrackEnabled
          ? 'trackEnabled'
          : 'trackDisabled')
      },
      _unpublish: {
        value: unpublish
      },
      kind: {
        enumerable: true,
        value: track.kind
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
   * Whether the published {@link LocalTrack} is enabled
   * @property {boolean}
   */
  get isTrackEnabled() {
    return this.track.kind === 'data' ? true : this.track.isEnabled;
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
