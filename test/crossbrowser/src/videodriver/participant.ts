import { EventEmitter } from 'events';
import SDKDriver from '../../../lib/sdkdriver/src';
import TrackDriver, { TrackID, TrackKind } from './track';
const { difference } = require('../../../../lib/util');

/**
 * A {@link ParticipantSID} is a 34-character string starting with "PA"
 * that uniquely identifies a {@link Room}.
 * @type string
 * @typedef RoomSID
 */
export type ParticipantSID = string;

/**
 * {@link Participant} driver.
 * @classdesc A {@link ParticipantDriver} manages the execution of the
 *   corresponding {@link Participant}'s methods in the browser and
 *   re-emits its events.
 * @extends EventEmitter
 * @property {Map<TrackID, TrackDriver>} audioTracks
 * @property {Map<TrackID, TrackDriver>} dataTracks
 * @property {string} identity
 * @property {ParticipantSID} sid
 * @property {string} state
 * @property {Map<TrackID, TrackDriver>} tracks
 * @property {Map<TrackID, TrackDriver>} videoTracks
 * @fires ParticipantDriver#trackAdded
 * @fires ParticipantDriver#trackRemoved
 */
export default class ParticipantDriver extends EventEmitter {
  protected readonly _pendingTracks: Map<TrackID, TrackDriver>;
  protected readonly _resourceId: string;
  protected readonly _sdkDriver: SDKDriver;
  private readonly _removedTracks: Map<TrackID, TrackDriver>;
  private readonly _DataTrackDriver: typeof TrackDriver;
  private readonly _MediaTrackDriver: typeof TrackDriver;
  readonly audioTracks: Map<TrackID, TrackDriver>;
  readonly dataTracks: Map<TrackID, TrackDriver>;
  readonly tracks: Map<TrackID, TrackDriver>;
  readonly videoTracks: Map<TrackID, TrackDriver>;
  identity: string;
  sid: ParticipantSID;
  state: string;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedParticipant
   * @param {typeof TrackDriver} DataTrackDriver
   * @param {typeof TrackDriver} MediaTrackDriver
   */
  constructor(sdkDriver: SDKDriver,
    serializedParticipant: any,
    DataTrackDriver: typeof TrackDriver,
    MediaTrackDriver: typeof TrackDriver) {
    super();
    this.audioTracks = new Map();
    this.dataTracks = new Map();
    this.tracks = new Map();
    this.videoTracks = new Map();
    this._pendingTracks = new Map();
    this._removedTracks = new Map();
    this._resourceId = serializedParticipant._resourceId;
    this._sdkDriver = sdkDriver;
    this._DataTrackDriver = DataTrackDriver;
    this._MediaTrackDriver = MediaTrackDriver;
    this._update(serializedParticipant);
    sdkDriver.on('event', (data: any) => this._reemitEvents(data));
  }

  /**
   * Re-emit the "trackAdded" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  protected _reemitTrackAdded(source: any, args: any): void {
    this._update(source);
    const serializedTrack: any = args[0];
    this.emit('trackAdded', this.tracks.get(serializedTrack.id));
  }

  /**
   * Re-emit the "trackRemoved" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  protected _reemitTrackRemoved(source: any, args: any): void {
    this._update(source);
    const serializedTrack: any = args[0];
    this.emit('trackRemoved', this._removeOrGetRemovedTrack(serializedTrack.id));
  }

  /**
   * Re-emit {@link Participant}'s events from the browser.
   * @private
   * @param {object} data
   * @returns {void}
   */
  protected _reemitEvents(data: any): void {
    const { type, source, args } = data;
    if (source._resourceId !== this._resourceId) {
      return;
    }
    switch (type) {
      case 'trackAdded':
        this._reemitTrackAdded(source, args);
        break;
      case 'trackRemoved':
        this._reemitTrackRemoved(source, args);
        break;
    }
  }

  /**
   * Remove or get an already removed {@link TrackDriver}.
   * @protected
   * @param {TrackID} id
   * @returns {TrackDriver}
   */
  protected _removeOrGetRemovedTrack(id: TrackID): TrackDriver {
    const track: TrackDriver | undefined = this.tracks.get(id);
    if (track) {
      this.tracks.delete(id);
      this[`${track.kind}Tracks`].delete(id);
      this._removedTracks.set(id, track);
    }
    return this._removedTracks.get(id) as TrackDriver;
  }

  /**
   * Update the {@link ParticipantDriver}'s properties.
   * @protected
   * @param {object} serializedParticipant
   * @returns {void}
   */
  protected _update(serializedParticipant: any): void {
    const {
      identity,
      sid,
      state,
      tracks
    } = serializedParticipant;

    this.identity = identity;
    this.sid = sid;
    this.state = state;

    const TrackDriver = {
      audio: this._MediaTrackDriver,
      data: this._DataTrackDriver,
      video: this._MediaTrackDriver
    };

    const serializedTracks: Map<TrackID, any> = new Map(tracks.map((serializedTrack: any) => [
      serializedTrack.id,
      serializedTrack
    ]));

    const tracksToAdd: Set<TrackID> = difference(
      Array.from(serializedTracks.keys()),
      Array.from(this.tracks.keys()));

    const tracksToRemove: Set<TrackID> = difference(
      Array.from(this.tracks.keys()),
      Array.from(serializedTracks.keys()));

    tracksToAdd.forEach((trackId: TrackID) => {
      const serializedTrack: any = serializedTracks.get(trackId);
      const kind: TrackKind = serializedTrack.kind;

      const track: TrackDriver = this._pendingTracks.get(trackId)
        || new TrackDriver[kind](this._sdkDriver, serializedTrack);

      this.tracks.set(trackId, track);
      this[`${kind}Tracks`].set(trackId, track);
      this._pendingTracks.delete(trackId);
    });

    tracksToRemove.forEach((trackId: TrackID) => {
      this._removeOrGetRemovedTrack(trackId);
    });
  }

  /**
   * Get a removed {@link TrackDriver}.
   * @param {TrackID} id
   * @returns {?TrackDriver}
   */
  getRemovedTrack(id: TrackID): TrackDriver | undefined {
    return this._removeOrGetRemovedTrack(id);
  }
}

/**
 * @param {TrackDriver} track
 * @event ParticipantDriver#trackAdded
 */

/**
 * @param {TrackDriver} track
 * @event ParticipantDriver#trackRemoved
 */
