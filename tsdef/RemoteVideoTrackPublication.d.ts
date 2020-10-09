import { RemoteTrackPublication } from './RemoteTrackPublication';
import { RemoteVideoTrack } from './RemoteVideoTrack';
import { TwilioError } from './TwilioError';

export class RemoteVideoTrackPublication extends RemoteTrackPublication {
  kind: 'video';
  track: RemoteVideoTrack | null;

  on(event: 'subscribed', listener: (track: RemoteVideoTrack) => void): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => void): this;
  on(event: 'trackSwitchedOff', listener: (track: RemoteVideoTrack) => void): this;
  on(event: 'trackSwitchedOn', listener: (track: RemoteVideoTrack) => void): this;
  on(event: 'unsubscribed', listener: (track: RemoteVideoTrack) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
