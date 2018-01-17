import SDKDriver from '../../../lib/sdkdriver/src';
import TrackDriver, { TrackSID } from './track';

/**
 * {@link RemoteDataTrack} driver.
 * @classdesc A {@link RemoteDataTrackDriver} manages the execution of
 *   the corresponding {@link RemoteDataTrack}'s methods in the browser
 *   and re-emits its events.
 * @extends TrackDriver
 * @property {number} maxPacketLifetime
 * @property {number} maxRetransmits
 * @property {boolean} ordered
 * @property {boolean} reliable
 * @property {TrackSID} sid
 * @property {boolean} isSubscribed
 * @fires RemoteDataTrackDriver#message
 * @fires RemoteDataTrackDriver#unsubscribed
 */
export default class RemoteDataTrackDriver extends TrackDriver {
  readonly maxPacketLifetime: number;
  readonly maxRetransmits: number;
  readonly ordered: boolean;
  readonly reliable: boolean;
  readonly sid: TrackSID;
  isSubscribed: boolean;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedRemoteDataTrack
   */
  constructor(sdkDriver: SDKDriver, serializedRemoteDataTrack: any) {
    super(sdkDriver, serializedRemoteDataTrack);

    const {
      maxPacketLifetime,
      maxRetransmits,
      ordered,
      reliable,
      sid
    } = serializedRemoteDataTrack;

    this.maxPacketLifetime = maxPacketLifetime;
    this.maxRetransmits = maxRetransmits;
    this.ordered = ordered;
    this.reliable = reliable;
    this.sid = sid;
    this._update(serializedRemoteDataTrack);
  }

  /**
   * Update the {@link RemoteDataTrackDriver}'s properties.
   * @protected
   * @param {object} serializedRemoteDataTrack
   * @returns {void}
   */
  protected _update(serializedRemoteDataTrack: any): void {
    super._update(serializedRemoteDataTrack);
    this.isSubscribed = serializedRemoteDataTrack.isSubscribed;
  }
}

/**
 * @param {string} data
 * @event RemoteDataTrackDriver#message
 */

/**
 * @event RemoteDataTrackDriver#unsubscribed
 */
