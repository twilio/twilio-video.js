import { MediaTrack } from './MediaTrack';
import { VideoProcessor } from './VideoProcessor';

export namespace VideoTrack {
  interface Dimensions {
    width: number | null;
    height: number | null;
  }
}

export class VideoTrack extends MediaTrack {
  dimensions: VideoTrack.Dimensions;
  kind: 'video';
  processor: VideoProcessor | null;
  processedTrack: MediaStreamTrack | null;

  addProcessor(processor: VideoProcessor): this;
  removeProcessor(processor: VideoProcessor): this;
}
