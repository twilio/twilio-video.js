import SDKDriver from '../../../lib/sdkdriver/src';
import ParticipantDriver from './participant';

/**
 * {@link LocalParticipant} driver.
 * @classdesc A {@link LocalParticipantDriver} manages the execution of
 *   the corresponding {@link LocalParticipant}'s methods in the browser
 *   and reemits the {@link LocalParticipant}'s events.
 * @extends ParticipantDriver
 * @property {Map<TrackSID, object>} audioTrackPublications
 * @property {Map<TrackSID, object>} dataTrackPublications
 * @property {Map<TrackSID, object>} trackPublications
 * @property {Map<TrackSID, object>} videoTrackPublications
 * @fires LocalParticipantDriver#trackPublicationFailed
 * @fires LocalParticipantDriver#trackPublished
 */
export default class LocalParticipantDriver extends ParticipantDriver {
  private readonly _sdkDriver: SDKDriver;
  audioTrackPublications: Map<string, any>;
  dataTrackPublications: Map<string, any>;
  trackPublications: Map<string, any>;
  videoTrackPublications: Map<string, any>;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedLocalParticipant
   */
  constructor(sdkDriver: SDKDriver, serializedLocalParticipant: any) {
    super(sdkDriver, serializedLocalParticipant);
    this._sdkDriver = sdkDriver;
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
    const [ serializedError, serializedLocalTrack ] = args;
    const error: any = new Error(serializedError.message);
    error.code = serializedError.code;
    this.emit('trackPublicationFailed', error, serializedLocalTrack);
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
    this.emit('trackPublished', serializedLocalTrackPublication);
  }

  /**
   * Re-emit {@link LocalParticipant}'s events from the browser.
   * @private
   * @param {object} data
   * @returns {void}
   */
  protected _reemitEvents(data: any) {
    const { type, source, args } = data;
    if (source.sid !== this.sid) {
      return;
    }
    switch (type) {
      case 'localTrackAdded':
      case 'localTrackRemoved':
        this._update(source);
        break;
      case 'trackPublicationFailed':
        this._reemitTrackPublicationFailed(source, args);
        break;
      case 'trackPublished':
        this._reemitTrackPublished(source, args);
        break;
    }
  }

  /**
   * Update the {@link LocalParticipantDriver}'s properties.
   * @protected
   * @param {object} serializedParticipant
   * @returns {void}
   */
  protected _update(source: any): void {
    super._update(source);
    const {
      audioTrackPublications,
      dataTrackPublications,
      trackPublications,
      videoTrackPublications
    } = source;

    this.audioTrackPublications = new Map(audioTrackPublications.map((publication: any) => [
      publication.trackSid,
      publication
    ]));
    this.dataTrackPublications = new Map(dataTrackPublications.map((publication: any) => [
      publication.trackSid,
      publication
    ]));
    this.trackPublications = new Map(trackPublications.map((publication: any) => [
      publication.trackSid,
      publication
    ]));
    this.videoTrackPublications = new Map(videoTrackPublications.map((publication: any) => [
      publication.trackSid,
      publication
    ]));
  }

  /**
   * Publish a {@link LocalTrack} to the {@link Room} in the browser.
   * @param {object} localTrack
   * @returns {Promise<object>}
   */
  async publishTrack(localTrack: any): Promise<any> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'publishTrack',
      args: [localTrack.id],
      target: this.sid
    });

    if (error) {
      const err: any = new Error(error.message);
      err.code = error.code;
      throw err;
    }
    return result;
  }

  /**
   * Publish {@link LocalTrack}s to the {@link Room} in the browser.
   * @param {Array<object>} localTrack
   * @returns {Promise<Array<object>>}
   */
  async publishTracks(localTracks: Array<any>): Promise<Array<any>> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'publishTracks',
      args: [localTracks.map((track: any) => track.id)],
      target: this.sid
    });

    if (error) {
      const err: any = new Error(error.message);
      err.code = error.code;
      throw err;
    }
    return result;
  }

  async setParameters(encodingParameters: any): Promise<void> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'setParameters',
      args: [encodingParameters],
      target: this.sid
    });

    if (error) {
      throw new Error(error.message);
    }
    return result;
  }

  /**
   * Unpublish a {@link LocalTrack} from the {@link Room} in the browser.
   * @param {object} localTrack
   * @returns {Promise<object>}
   */
  async unpublishTrack(localTrack: any): Promise<any> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'unpublishTrack',
      args: [localTrack.id],
      target: this.sid
    });

    if (error) {
      throw new Error(error.message);
    }
    return result;
  }

  /**
   * Unpublish {@link LocalTrack}s from the {@link Room} in the browser.
   * @param {Array<object>} localTrack
   * @returns {Promise<Array<object>>}
   */
  async unpublishTracks(localTracks: Array<any>): Promise<Array<any>> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'unpublishTracks',
      args: [localTracks.map((track: any) => track.id)],
      target: this.sid
    });

    if (error) {
      throw new Error(error.message);
    }
    return result;
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
