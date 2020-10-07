import { RemoteTrack } from './types';
import { Track } from './Track';
import { TrackPublication } from './TrackPublication';
import { TwilioError } from './TwilioError';

export class RemoteTrackPublication extends TrackPublication {
  isSubscribed: boolean;
  publishPriority: Track.Priority;
  track: RemoteTrack | null;

  on(event: 'publishPriorityChanged', listener: (priority: Track.Priority) => any): this;
  on(event: 'subscribed', listener: (track: RemoteTrack) => any): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => any): this;
  on(event: 'trackSwitchedOff', listener: (track: RemoteTrack) => any): this;
  on(event: 'trackSwitchedOn', listener: (track: RemoteTrack) => any): this;
  on(event: 'unsubscribed', listener: (track: RemoteTrack) => any): this;
}
