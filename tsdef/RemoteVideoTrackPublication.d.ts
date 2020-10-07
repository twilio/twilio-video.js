import { RemoteTrackPublication } from './RemoteTrackPublication';
import { RemoteVideoTrack } from './RemoteVideoTrack';
import { TwilioError } from './TwilioError';

export class RemoteVideoTrackPublication extends RemoteTrackPublication {
  kind: 'video';
  track: RemoteVideoTrack | null;

  on(event: 'subscribed', listener: (track: RemoteVideoTrack) => any): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => any): this;
  on(event: 'trackSwitchedOff', listener: (track: RemoteVideoTrack) => any): this;
  on(event: 'trackSwitchedOn', listener: (track: RemoteVideoTrack) => any): this;
  on(event: 'unsubscribed', listener: (track: RemoteVideoTrack) => any): this;
}
