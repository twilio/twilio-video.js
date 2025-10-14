import SDKDriver from '../../../lib/sdkdriver/src';
import LocalDataTrackDriver from './localdatatrack';
import LocalMediaTrackDriver from './localmediatrack';
import LocalTrackPublicationDriver from './localtrackpublication';
import ParticipantDriver from './participant';
import TrackDriver, { TrackSID } from './track';
const { difference } = require('../../../../lib/util');

type LocalTrackDriver = LocalDataTrackDriver | LocalMediaTrackDriver;

/**
 * {@link LocalParticipant} driver.
 * @classdesc A {@link LocalParticipantDriver} manages the execution of
 *   the corresponding {@link LocalParticipant}'s methods in the browser
 *   and re-emits its events.
 * @extends ParticipantDriver
 * @property {Map<TrackSID, LocalTrackPublicationDriver>} audioTrackPublications
 * @property {Map<TrackSID, LocalTrackPublicationDriver>} dataTrackPublications
 * @property {Map<TrackSID, LocalTrackPublicationDriver>} trackPublications
 * @property {Map<TrackSID, LocalTrackPublicationDriver>} videoTrackPublications
 * @fires LocalParticipantDriver#trackPublicationFailed
 * @fires LocalParticipantDriver#trackPublished
 */
export default class LocalParticipantDriver extends ParticipantDriver {
  private _removedTrackPublications: Map<TrackSID, LocalTrackPublicationDriver>;
  audioTrackPublications: Map<TrackSID, LocalTrackPublicationDriver>;
  dataTrackPublications: Map<TrackSID, LocalTrackPublicationDriver>;
  trackPublications: Map<TrackSID, LocalTrackPublicationDriver>;
  videoTrackPublications: Map<TrackSID, LocalTrackPublicationDriver>;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedLocalParticipant
   */
  constructor(sdkDriver: SDKDriver, serializedLocalParticipant: any) {
    super(sdkDriver, serializedLocalParticipant, LocalDataTrackDriver, LocalMediaTrackDriver);
  }

  /**
   * Get or create a {@link LocalTrackPublicationDriver}.
   * @private
   * @param {object} serializedLocalTrackPublication
   * @returns {LocalTrackPublicationDriver}
   */
  private _getOrCreateLocalTrackPublication(serializedLocalTrackPublication: any): LocalTrackPublicationDriver {
    const { track, trackSid } = serializedLocalTrackPublication;
    const localTrack: LocalTrackDriver = this.tracks.get(track.id) as LocalTrackDriver;
    let localTrackPublication: LocalTrackPublicationDriver | undefined = this.trackPublications.get(trackSid);

    if (!localTrackPublication) {
      localTrackPublication = new LocalTrackPublicationDriver(this._sdkDriver, serializedLocalTrackPublication, localTrack);
      this.trackPublications.set(trackSid, localTrackPublication);
      this[`${track.kind}TrackPublications`].set(trackSid, localTrackPublication);
    }
    return localTrackPublication;
  }

  /**
   * Re-emit the "trackPublicationFailed" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitTrackPublicationFailed(source: any, args: any): void {
    this._update(source);
    const [serializedError, serializedLocalTrack] = args;
    const localTrack: TrackDriver = this._removeOrGetRemovedTrack(serializedLocalTrack.id);
    const error: any = new Error(serializedError.message);
    error.code = serializedError.code;
    this.emit('trackPublicationFailed', error, localTrack);
  }

  /**
   * Re-emit the "trackPublished" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitTrackPublished(source: any, args: any): void {
    this._update(source);
    const serializedLocalTrackPublication: any = args[0];
    this.emit('trackPublished', this._getOrCreateLocalTrackPublication(serializedLocalTrackPublication));
  }

  /**
   * Re-emit {@link LocalParticipant}'s events from the browser.
   * @private
   * @param {object} data
   * @returns {void}
   */
  protected _reemitEvents(data: any): void {
    const { type, source, args } = data;
    if (source._resourceId !== this._resourceId) {
      return;
    }
    super._reemitEvents(data);
    switch (type) {
      case 'trackPublicationFailed':
        this._reemitTrackPublicationFailed(source, args);
        break;
      case 'trackPublished':
        this._reemitTrackPublished(source, args);
        break;
    }
  }

  /**
   * Remove or get an already removed {@link LocalTrackPublicationDriver}.
   * @private
   * @param {TrackSID} trackSid
   * @returns {LocalTrackPublicationDriver}
   */
  private _removeOrGetRemovedLocalTrackPublication(trackSid: TrackSID): LocalTrackPublicationDriver {
    let localTrackPublication: LocalTrackPublicationDriver | undefined =  this._removedTrackPublications.get(trackSid);
    if (localTrackPublication) {
      return localTrackPublication;
    }
    localTrackPublication = this.trackPublications.get(trackSid);

    if (localTrackPublication) {
      this.trackPublications.delete(trackSid);
      this[`${localTrackPublication.track.kind}TrackPublications`].delete(trackSid);
      this._removedTrackPublications.set(trackSid, localTrackPublication);
    }
    return localTrackPublication as LocalTrackPublicationDriver;
  }

  /**
   * Update the {@link LocalParticipantDriver}'s properties.
   * @protected
   * @param {object} serializedLocalParticipant
   * @returns {void}
   */
  protected _update(serializedLocalParticipant: any): void {
    super._update(serializedLocalParticipant);

    this.audioTrackPublications = this.audioTrackPublications || new Map();
    this.dataTrackPublications = this.dataTrackPublications || new Map();
    this.trackPublications = this.trackPublications || new Map();
    this.videoTrackPublications = this.videoTrackPublications || new Map();
    this._removedTrackPublications = this._removedTrackPublications || new Map();

    const { trackPublications } = serializedLocalParticipant;
    const localTrackPublications: Map<TrackSID, any> = new Map(trackPublications.map((serializedLocalTrackPublication: any) => [
      serializedLocalTrackPublication.trackSid,
      serializedLocalTrackPublication
    ]));

    const localTrackPublicationsToAdd: Set<TrackSID> = difference(
      Array.from(localTrackPublications.keys()),
      Array.from(this.trackPublications.keys()));

    const localTrackPublicationsToRemove: Set<TrackSID> = difference(
      Array.from(this.trackPublications.keys()),
      Array.from(localTrackPublications.keys()));

    localTrackPublicationsToAdd.forEach((trackSid: TrackSID) => {
      const serializedLocalTrackPublication: any = localTrackPublications.get(trackSid);
      this._getOrCreateLocalTrackPublication(serializedLocalTrackPublication);
    });

    localTrackPublicationsToRemove.forEach((trackSid: TrackSID) => {
      this._removeOrGetRemovedLocalTrackPublication(trackSid);
    });
  }

  /**
   * Publish a {@link LocalTrack} to the {@link Room} in the browser.
   * @param {LocalTrackDriver} localTrack
   * @returns {Promise<LocalTrackPublicationDriver>}
   */
  async publishTrack(localTrack: LocalTrackDriver): Promise<LocalTrackPublicationDriver> {
    this._pendingTracks.set(localTrack.id, localTrack);

    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'publishTrack',
      args: [localTrack.resourceId],
      target: this._resourceId
    });

    if (error) {
      this._pendingTracks.delete(localTrack.id);
      const err: any = new Error(error.message);
      err.code = error.code;
      throw err;
    }
    return this._getOrCreateLocalTrackPublication(result);
  }

  /**
   * Publish {@link LocalTrack}s to the {@link Room} in the browser.
   * @param {Array<LocalTrackDriver>} localTrack
   * @returns {Promise<Array<LocalTrackPublicationDriver>>}
   */
  async publishTracks(localTracks: Array<LocalTrackDriver>): Promise<Array<LocalTrackPublicationDriver>> {
    localTracks.forEach((localTrack: LocalTrackDriver) => {
      this._pendingTracks.set(localTrack.id, localTrack);
    });

    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'publishTracks',
      args: [localTracks.map((localTrack: LocalTrackDriver) => localTrack.resourceId)],
      target: this._resourceId
    });

    if (error) {
      const err: any = new Error(error.message);
      err.code = error.code;
      throw err;
    }

    return result.map((serializedLocalTrackPublication: any) => {
      return this._getOrCreateLocalTrackPublication(serializedLocalTrackPublication);
    });
  }

  /**
   * Set {@link EncodingParameters} to the {@link LocalParticipant}
   * in the browser.
   * @param {?EncodingParameters} encodingParameters
   * @returns {Promise<void>}
   */
  async setParameters(encodingParameters: any): Promise<void> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'setParameters',
      args: [encodingParameters],
      target: this._resourceId
    });

    if (error) {
      throw new Error(error.message);
    }
    return result;
  }

  /**
   * Unpublish a {@link LocalTrack} from the {@link Room} in the browser.
   * @param {LocalTrackDriver} localTrack
   * @returns {Promise<LocalTrackPublicationDriver>}
   */
  async unpublishTrack(localTrack: LocalTrackDriver): Promise<LocalTrackPublicationDriver> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'unpublishTrack',
      args: [localTrack.resourceId],
      target: this._resourceId
    });

    if (error) {
      throw new Error(error.message);
    }
    return this._removeOrGetRemovedLocalTrackPublication(result.trackSid);
  }

  /**
   * Unpublish {@link LocalTrack}s from the {@link Room} in the browser.
   * @param {Array<LocalTrackDriver>} localTracks
   * @returns {Promise<Array<LocalTrackPublicationDriver>>}
   */
  async unpublishTracks(localTracks: Array<LocalTrackDriver>): Promise<Array<LocalTrackPublicationDriver>> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'unpublishTracks',
      args: [localTracks.map((track: any) => track.resourceId)],
      target: this._resourceId
    });

    if (error) {
      throw new Error(error.message);
    }

    return result.map((serializedLocalTrackPublication: any) => {
      return this._removeOrGetRemovedLocalTrackPublication(serializedLocalTrackPublication.trackSid);
    });
  }
}

/**
 * @param {TwilioError} error
 * @param {LocalTrackDriver} localTrack
 * @event LocalParticipantDriver#trackPublicationFailed
 */

/**
 * @param {LocalTrackPublicationDriver} publication
 * @event LocalParticipantDriver#trackPublished
 */
