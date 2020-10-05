import { RemoteTrackPublication } from './RemoteTrackPublication';
import { Track } from './Track';

export class RemoteDataTrackPublication extends RemoteTrackPublication {
  kind: Track.Kind | 'data';
  track: RemoteDataTrack | null;

  on(event: 'subscribed', listener: (track: RemoteDataTrack) => any): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => any): this;
  on(event: 'unsubscribed', listener: (track: RemoteDataTrack) => any): this;
}
