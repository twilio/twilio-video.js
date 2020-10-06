import { RemoteTrackPublication } from './RemoteTrackPublication';
import { RemoteVideoTrack } from './RemoteVideoTrack';

export class RemoteVideoTrackPublication extends RemoteTrackPublication {
  kind: 'video';
  track: RemoteVideoTrack | null;

  on(event: 'subscribed', listener: (track: RemoteVideoTrack) => any): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => any): this;
  on(event: 'trackDisabled', listener: () => any): this;
  on(event: 'trackEnabled', listener: () => any): this;
  on(event: 'unsubscribed', listener: (track: RemoteVideoTrack) => any): this;
}
