import { Track } from './Track';
import { TrackPublication } from './TrackPublication';

export class RemoteTrackPublication extends TrackPublication {
  isSubscribed: boolean;
  isTrackEnabled: boolean;
  kind: Track.Kind;
  publishPriority: Track.Priority;
  track: RemoteTrack | null;

  on(event: 'publishPriorityChanged', listener: (priority: Track.Priority) => any): this;
  on(event: 'subscribed', listener: (track: RemoteTrack) => any): this;
  on(event: 'subscriptionFailed', listener: (error: TwilioError) => any): this;
  on(event: 'trackDisabled', listener: () => any): this;
  on(event: 'trackEnabled', listener: () => any): this;
  on(event: 'trackSwitchedOff', listener: (track: RemoteTrack) => any): this;
  on(event: 'trackSwitchedOn', listener: (track: RemoteTrack) => any): this;
  on(event: 'unsubscribed', listener: (track: RemoteTrack) => any): this;
}
