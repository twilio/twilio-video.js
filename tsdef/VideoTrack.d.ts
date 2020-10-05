import { Track } from './Track';

export namespace VideoTrack {
  interface Dimensions {
      width: number | null;
      height: number | null;
  }
}

export class VideoTrack extends Track {
  isStarted: boolean;
  isEnabled: boolean;
  dimensions: VideoTrack.Dimensions;
  kind: 'video';
  mediaStreamTrack: MediaStreamTrack;

  _attachments?: HTMLMediaElement[];

  attach(element?: HTMLMediaElement | string): HTMLVideoElement;
  detach(element?: HTMLMediaElement | string): HTMLMediaElement[];

  on(event: 'disabled', listener: (track: this) => any): this;
  on(event: 'enabled', listener: (track: this) => any): this;
  on(event: 'started', listener: (track: this) => any): this;
}
