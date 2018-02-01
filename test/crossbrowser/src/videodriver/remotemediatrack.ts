import SDKDriver from '../../../lib/sdkdriver/src';
import MediaTrackDriver from './mediatrack';
import { TrackSID } from './track';

/**
 * {@link RemoteMediaTrack} driver.
 * @classdesc A {@link RemoteMediaTrackDriver} manages the execution of
 *   the corresponding {@link RemoteMediaTrack}'s methods in the browser
 *   and re-emits its events.
 * @extends MediaTrackDriver
 * @property {TrackSID} sid
 * @property {boolean} isSubscribed
 * @fires RemoteMediaTrackDriver#unsubscribed
 */
export default class RemoteMediaTrackDriver extends MediaTrackDriver {
  readonly sid: TrackSID;
  isSubscribed: boolean;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedRemoteMediaTrack
   */
  constructor(sdkDriver: SDKDriver, serializedRemoteMediaTrack: any) {
    super(sdkDriver, serializedRemoteMediaTrack);
    this.sid = serializedRemoteMediaTrack.sid;
    this._update(serializedRemoteMediaTrack);
  }

  /**
   * Update the {@link RemoteMediaTrackDriver}'s properties.
   * @protected
   * @param serializedRemoteMediaTrack
   */
  protected _update(serializedRemoteMediaTrack: any): void {
    super._update(serializedRemoteMediaTrack);
    this.isSubscribed = serializedRemoteMediaTrack.isSubscribed;
  }
}

/**
 * @event RemoteMediaTrackDriver#unsubscribed
 */
