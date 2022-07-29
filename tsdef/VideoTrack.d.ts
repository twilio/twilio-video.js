import { Track } from './Track';
import { VideoProcessor } from './VideoProcessor';
import { AddProcessorOptions } from './types';

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
  processor: VideoProcessor | null;
  mediaStreamTrack: MediaStreamTrack;
  processedTrack: MediaStreamTrack | null;

  addProcessor(processor: VideoProcessor, options?: AddProcessorOptions): this;
  removeProcessor(processor: VideoProcessor): this;
  attach(element?: HTMLMediaElement | string): HTMLVideoElement;
  detach(element?: HTMLMediaElement | string): HTMLVideoElement[];

  on(event: 'disabled', listener: (track: this) => void): this;
  on(event: 'enabled', listener: (track: this) => void): this;
  on(event: 'started', listener: (track: this) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
