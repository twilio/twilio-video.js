import { RemoteAudioTrack } from './RemoteAudioTrack';
import { RemoteTrackPublication } from './RemoteTrackPublication';
import { TwilioError } from './TwilioError';

export class RemoteAudioTrackPublication extends RemoteTrackPublication {
  kind: 'audio';
  track: RemoteAudioTrack | null;

  on(event: 'subscribed', listener: (track: RemoteAudioTrack) => void): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => void): this;
  on(event: 'trackDisabled', listener: () => void): this;
  on(event: 'trackEnabled', listener: () => void): this;
  on(event: 'unsubscribed', listener: (track: RemoteAudioTrack) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
