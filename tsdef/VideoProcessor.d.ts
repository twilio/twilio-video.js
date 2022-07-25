export class VideoProcessor {
  processFrame(inputFrameBuffer: OffscreenCanvas | HTMLCanvasElement, outputFrameBuffer: HTMLCanvasElement): Promise<void> | void;
}
