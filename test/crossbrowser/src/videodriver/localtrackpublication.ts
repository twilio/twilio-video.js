import SDKDriver from '../../../lib/sdkdriver/src';
import LocalDataTrackDriver from './localdatatrack';
import LocalMediaTrackDriver from './localmediatrack';
import { TrackKind, TrackSID } from './track';

type LocalTrackDriver = LocalDataTrackDriver | LocalMediaTrackDriver;

/**
 * {@link LocalTrackPublication} driver.
 * @classdesc A {@link LocalTrackPublicationDriver} manages the execution
 *   of the corresponding {@link LocalTrackPublication}'s methods in the
 *   browser.
 * @property {TrackKind} kind
 * @property {LocalTrackDriver} track
 * @property {string} trackName
 * @property {TrackSID} trackSid
 */
export default class LocalTrackPublicationDriver {
  private readonly _resourceId: string;
  private readonly _sdkDriver: SDKDriver;
  readonly kind: TrackKind;
  readonly track: LocalTrackDriver;
  readonly trackName: string;
  readonly trackSid: TrackSID;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedLocalTrackPublication
   * @param {LocalTrackDriver} localTrackDriver
   */
  constructor(sdkDriver: SDKDriver, serializedLocalTrackPublication: any, localTrackDriver: LocalTrackDriver) {
    this._resourceId = serializedLocalTrackPublication._resourceId;
    this._sdkDriver = sdkDriver;
    this.kind = serializedLocalTrackPublication.kind;
    this.track = localTrackDriver;
    this.trackName = serializedLocalTrackPublication.trackName;
    this.trackSid = serializedLocalTrackPublication.trackSid;
  }

  /**
   * Unpublish the {@link LocalTrackPublication} in the browser.
   * @returns {Promise<LocalTrackPublicationDriver>}
   */
  async unpublish(): Promise<LocalTrackPublicationDriver> {
    const { error } = await this._sdkDriver.sendRequest({
      api: 'unpublish',
      target: this._resourceId
    });

    if (error) {
      throw new Error(error.message);
    }
    return this;
  }
}
