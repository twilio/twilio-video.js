import { RemoteTrackPublication } from './RemoteTrackPublication';
import { RemoteVideoTrack } from './RemoteVideoTrack';
import { TwilioError } from './TwilioError';

export class RemoteVideoTrackPublication extends RemoteTrackPublication {
  kind: 'video';
  track: RemoteVideoTrack | null;

  on(event: 'subscribed', listener: (track: RemoteVideoTrack) => void): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => void): this;
  /**
   * @deprecated Use "trackSwitchedOff" (.switchOffReason === Track.SwitchOffReason.DISABLED_BY_PUBLISHER) instead
   */
  on(event: 'trackDisabled', listener: () => void): this;
  /**
   * @deprecated Use "trackSwitchedOn" instead
   */
  on(event: 'trackEnabled', listener: () => void): this;
  on(event: 'trackSwitchedOff', listener: (track: RemoteVideoTrack) => void): this;
  on(event: 'trackSwitchedOn', listener: (track: RemoteVideoTrack) => void): this;
  on(event: 'unsubscribed', listener: (track: RemoteVideoTrack) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
