import SDKDriver from '../../../lib/sdkdriver/src';
import TrackDriver from './track';

/**
 * {@link MediaTrack} driver.
 * @classdesc A {@link MediaTrackDriver} manages the execution of
 *   the corresponding {@link MediaTrack}'s methods in the browser
 *   and re-emits its events.
 * @extends TrackDriver
 * @property {boolean} isEnabled
 * @property {boolean} isStarted
 * @fires MediaTrackDriver#disabled
 * @fires MediaTrackDriver#enabled
 * @fires MediaTrackDriver#started
 */
export default class MediaTrackDriver extends TrackDriver {
  isEnabled: boolean;
  isStarted: boolean;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedMediaTrack
   */
  constructor(sdkDriver: SDKDriver, serializedMediaTrack: any) {
    super(sdkDriver, serializedMediaTrack);
    this._update(serializedMediaTrack);
  }

  /**
   * Update the {@link MediaTrackDriver}'s properties.
   * @protected
   * @param {object} serializedMediaTrack
   * @returns {void}
   */
  protected _update(serializedMediaTrack: any): void {
    super._update(serializedMediaTrack);
    this.isEnabled = serializedMediaTrack.isEnabled;
    this.isStarted = serializedMediaTrack.isStarted;
  }
}

/**
 * @event MediaTrackDriver#disabled
 */

/**
 * @event MediaTrackDriver#enabled
 */

/**
 * @event MediaTrackDriver#started
 */
