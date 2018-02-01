import SDKDriver from '../../../lib/sdkdriver/src';
import MediaTrackDriver from './mediatrack';

/**
 * {@link LocalMediaTrack} driver.
 * @classdesc A {@link LocalMediaTrackDriver} manages the execution of
 *   the corresponding {@link LocalMediaTrack}'s methods in the browser
 *   and re-emits its events.
 * @extends MediaTrackDriver
 * @property {boolean} isStopped
 * @fires LocalMediaTrackDriver#stopped
 */
export default class LocalMediaTrackDriver extends MediaTrackDriver {
  private readonly _sdkDriver: SDKDriver;
  isStopped: boolean;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedLocalMediaTrack
   */
  constructor(sdkDriver: SDKDriver, serializedLocalMediaTrack: any) {
    super(sdkDriver, serializedLocalMediaTrack);
    this._sdkDriver = sdkDriver;
    this._update(serializedLocalMediaTrack);
  }

  /**
   * Update the {@link LocalMediaTrackDriver}'s properties.
   * @protected
   * @param {object} serializedLocalMediaTrack
   * @returns {void}
   */
  protected _update(serializedLocalMediaTrack: any): void {
    super._update(serializedLocalMediaTrack);
    this.isStopped = serializedLocalMediaTrack.isStopped;
  }

  /**
   * Disable the {@link LocalMediaTrack} in the browser.
   * @returns {Promise<void>}
   */
  async disable(): Promise<void> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'disable',
      target: this._resourceId
    });

    if (error) {
      throw new Error(error.message);
    }
    this._update(result);
  }

  /**
   * Enable (or disable) the {@link LocalMediaTrack} in the browser.
   * @param {?boolean} enabled
   * @returns {Promise<void>}
   */
  async enable(enabled?: boolean): Promise<void> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'enable',
      args: [enabled],
      target: this._resourceId
    });

    if (error) {
      throw new Error(error.message);
    }
    this._update(result);
  }

  /**
   * Stop the {@link LocalMediaTrack} in the browser.
   * @param {?boolean} enabled
   * @returns {Promise<void>}
   */
  async stop(): Promise<void> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'stop',
      target: this._resourceId
    });

    if (error) {
      throw new Error(error.message);
    }
    this._update(result);
  }
}

/**
 * @event LocalMediaTrackDriver#stopped
 */
