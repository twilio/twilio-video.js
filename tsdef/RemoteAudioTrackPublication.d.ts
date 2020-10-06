import { RemoteTrackPublication } from './RemoteTrackPublication';

export class RemoteAudioTrackPublication extends RemoteTrackPublication {
  kind: 'audio';
  track: RemoteAudioTrack | null;

  on(event: 'subscribed', listener: (track: RemoteAudioTrack) => any): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => any): this;
  on(event: 'trackDisabled', listener: () => any): this;
  on(event: 'trackEnabled', listener: () => any): this;
  on(event: 'unsubscribed', listener: (track: RemoteAudioTrack) => any): this;
}
