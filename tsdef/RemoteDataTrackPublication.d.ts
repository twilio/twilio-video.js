import { RemoteDataTrack } from './RemoteDataTrack';
import { RemoteTrackPublication } from './RemoteTrackPublication';
import { TwilioError } from './TwilioError';

export class RemoteDataTrackPublication extends RemoteTrackPublication {
  kind: 'data';
  track: RemoteDataTrack | null;

  on(event: 'subscribed', listener: (track: RemoteDataTrack) => void): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => void): this;
  on(event: 'unsubscribed', listener: (track: RemoteDataTrack) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
