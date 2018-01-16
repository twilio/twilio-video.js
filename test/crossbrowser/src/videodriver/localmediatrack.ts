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
   * @returns {void}
   */
  disable(): void {
    this._sdkDriver.sendRequest({
      api: 'disable',
      target: this._resourceId
    }).then(() => {
      // Do nothing.
    }, () => {
      // Do nothing.
    });
  }

  /**
   * Enable (or disable) the {@link LocalMediaTrack} in the browser.
   * @param {?boolean} enabled
   * @returns {void}
   */
  enable(enabled?: boolean): void {
    this._sdkDriver.sendRequest({
      api: 'enable',
      args: [enabled],
      target: this._resourceId
    }).then(() => {
      // Do nothing.
    }, () => {
      // Do nothing.
    });
  }
}

/**
 * @event LocalMediaTrackDriver#stopped
 */
