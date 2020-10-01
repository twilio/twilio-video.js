import { RemoteTrackPublication } from './RemoteTrackPublication';
import { Track } from './Track';

export class RemoteAudioTrackPublication extends RemoteTrackPublication {
  kind: Track.Kind | 'audio';
  track: RemoteAudioTrack | null;

  on(event: 'subscribed', listener: (track: RemoteAudioTrack) => void): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => void): this;
  on(event: 'trackDisabled', listener: () => void): this;
  on(event: 'trackEnabled', listener: () => void): this;
  on(event: 'unsubscribed', listener: (track: RemoteAudioTrack) => void): this;
}
