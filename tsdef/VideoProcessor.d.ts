export class VideoProcessor {
  processFrame(inputFrameBuffer: OffscreenCanvas, outputFrameBuffer: OffscreenCanvas): Promise<void> | void;
}
