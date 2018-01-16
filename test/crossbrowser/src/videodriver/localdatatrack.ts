import SDKDriver from '../../../lib/sdkdriver/src';
import TrackDriver from './track';

/**
 * {@link LocalDataTrack} driver.
 * @classdesc A {@link LocalDataTrackDriver} manages the execution of
 *   the corresponding {@link LocalDataTrack}'s methods in the browser.
 * @extends TrackDriver
 * @property {number} maxPacketLifetime
 * @property {number} maxRetransmits
 * @property {boolean} ordered
 * @property {boolean} reliable
 */
export default class LocalDataTrackDriver extends TrackDriver {
  private readonly _sdkDriver: SDKDriver;
  readonly maxPacketLifetime: number;
  readonly maxRetransmits: number;
  readonly ordered: boolean;
  readonly reliable: boolean;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedLocalDataTrack
   */
  constructor(sdkDriver: SDKDriver, serializedLocalDataTrack: any) {
    super(sdkDriver, serializedLocalDataTrack);
    this._sdkDriver = sdkDriver;

    const {
      maxPacketLifetime,
      maxRetransmits,
      ordered,
      reliable
    } = serializedLocalDataTrack;

    this.maxPacketLifetime = maxPacketLifetime;
    this.maxRetransmits = maxRetransmits;
    this.ordered = ordered;
    this.reliable = reliable;
  }

  /**
   * Send a message using the {@link LocalDataTrack} in the browser.
   * @param {*} data
   * @returns {void}
   */
  send(data: any): void {
    this._sdkDriver.sendRequest({
      args: [data],
      api: 'send',
      target: this._resourceId
    }).then(() => {
      // Do nothing.
    }, () => {
      // Do nothing.
    });
  }
}
