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

  attach(element?: HTMLMediaElement | string): HTMLVideoElement;
  detach(element?: HTMLMediaElement | string): HTMLVideoElement[];

  on(event: 'disabled', listener: (track: this) => void): this;
  on(event: 'enabled', listener: (track: this) => void): this;
  on(event: 'started', listener: (track: this) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
