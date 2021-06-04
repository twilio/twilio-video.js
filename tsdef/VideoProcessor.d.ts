export class VideoProcessor {
  processFrame(inputFrameBuffer: OffscreenCanvas, outputFrameBuffer: HTMLCanvasElement): Promise<void> | void;
}
