import { EventEmitter } from 'events';
import SDKDriver from '../../../lib/sdkdriver/src';

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
 *   corresponding {@link Participant}'s methods in the browser and reemits
 *   the {@link Participant}'s events.
 * @extends EventEmitter
 * @property {Map<TrackSID, object>} audioTracks
 * @property {Map<TrackSID, object>} dataTracks
 * @property {string} identity
 * @property {ParticipantSID} sid
 * @property {string} state
 * @property {Map<TrackSID, object>} tracks
 * @property {Map<TrackSID, object>} videoTracks
 * @fires ParticipantDriver#disconnected
 * @fires ParticipantDriver#trackAdded
 * @fires ParticipantDriver#trackRemoved
 * @fires ParticipantDriver#trackSubscribed
 * @fires ParticipantDriver#trackUnsubscribed
 */
export default class ParticipantDriver extends EventEmitter {
  audioTracks: Map<string, any>;
  dataTracks: Map<string, any>;
  identity: string;
  sid: ParticipantSID;
  state: string;
  tracks: Map<string, any>;
  videoTracks: Map<string, any>;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedParticipant
   */
  constructor(sdkDriver: SDKDriver, serializedParticipant: any) {
    super();
    this._update(serializedParticipant);
    sdkDriver.on('event', (data: any) => this._reemitEvents(data));
  }

  /**
   * Re-emit the "disconnected" event from the browser.
   * @private
   * @param {object} source
   * @returns {void}
   */
  private _reemitDisconnected(source: any): void {
    this._update(source);
    this.emit('disconnected', this);
  }

  /**
   * Re-emit the "trackAdded" event from the browser.
   * @private
   * @param {object} source
   * @param {*} args
   * @returns {void}
   */
  private _reemitTrackAdded(source: any, args: any): void {
    this._update(source);
    const serializedTrack: any = args[0];
    this.emit('trackAdded', serializedTrack);
  }

  /**
   * Re-emit the "trackRemoved" event from the browser.
   * @private
   * @param {object} source
   * @param {*} args
   * @returns {void}
   */
  private _reemitTrackRemoved(source: any, args: any): void {
    this._update(source);
    const serializedTrack: any = args[0];
    this.emit('trackRemoved', serializedTrack);
  }

  /**
   * Re-emit the "trackSubscribed" event from the browser.
   * @private
   * @param {object} source
   * @param {*} args
   * @returns {void}
   */
  private _reemitTrackSubscribed(source: any, args: any): void {
    this._update(source);
    const serializedTrack: any = args[0];
    this.emit('trackSubscribed', serializedTrack);
  }

  /**
   * Re-emit the "trackUnsubscribed" event from the browser.
   * @private
   * @param {object} source
   * @param {*} args
   * @returns {void}
   */
  private _reemitTrackUnsubscribed(source: any, args: any): void {
    this._update(source);
    const serializedTrack: any = args[0];
    this.emit('trackUnsubscribed', serializedTrack);
  }

  protected _reemitEvents(data: any) {
    const { type, source, args } = data;
    if (source.sid !== this.sid) {
      return;
    }
    switch (type) {
      case 'disconnected':
        this._reemitDisconnected(source);
        break;
      case 'trackAdded':
        this._reemitTrackAdded(source, args);
        break;
      case 'trackRemoved':
        this._reemitTrackRemoved(source, args);
        break;
      case 'trackSubscribed':
        this._reemitTrackSubscribed(source, args);
        break;
      case 'trackUnsubscribed':
        this._reemitTrackUnsubscribed(source, args);
        break;
    }
  }

  /**
   * Update the {@link ParticipantDriver}'s properties.
   * @param {object} serializedParticipant
   * @returns {void}
   */
  protected _update(serializedParticipant: any): void {
    const {
      audioTracks,
      dataTracks,
      identity,
      sid,
      state,
      tracks,
      videoTracks
    } = serializedParticipant;

    this.audioTracks = new Map(audioTracks.map((track: any) => [track.id, track]));
    this.dataTracks = new Map(dataTracks.map((track: any) => [track.id, track]));
    this.identity = identity;
    this.sid = sid;
    this.state = state;
    this.tracks = new Map(tracks.map((track: any) => [track.id, track]));
    this.videoTracks = new Map(videoTracks.map((track: any) => [track.id, track]));
  }
}

/**
 * @param {ParticipantDriver} participant
 * @event ParticipantDriver#disconnected
 */

/**
 * @param {VideoTrackDriver} track
 * @event ParticipantDriver#trackDimensionsChanged
 */

/**
 * @param {TrackDriver} track
 * @event ParticipantDriver#trackDisabled
 */

/**
 * @param {TrackDriver} track
 * @event ParticipantDriver#trackEnabled
 */

/**
 * @param {TrackDriver} track
 * @event ParticipantDriver#trackStarted
 */

/**
 * @param {TrackDriver} track
 * @event ParticipantDriver#trackSubscribed
 */

/**
 * @param {TrackDriver} track
 * @event ParticipantDriver#trackUnsubscribed
 */
