import { RemoteTrackPublication } from './RemoteTrackPublication';

export class RemoteDataTrackPublication extends RemoteTrackPublication {
  kind: 'data';
  track: RemoteDataTrack | null;

  on(event: 'subscribed', listener: (track: RemoteDataTrack) => any): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => any): this;
  on(event: 'unsubscribed', listener: (track: RemoteDataTrack) => any): this;
}
