declare class VideoFrame {
  displayHeight: number;
  displayWidth: number;
  timestamp: number;
  constructor(videoSource: HTMLVideoElement);
  close(): void;
}

/**
 * A processor for manipulating video frames.
 */
export class VideoProcessor {
  /**
   * Process a video frame.
   * @param inputFrameBuffer The input frame buffer. Can be one of:
   * - OffscreenCanvas
   * - HTMLCanvasElement
   * - HTMLVideoElement
   * - VideoFrame
   * @param outputFrameBuffer The output frame buffer. The context type can be:
   * - '2d'
   * - 'bitmaprenderer'
   * @returns A Promise that resolves when the frame has been processed, or void for synchronous processing
   */
  processFrame(
    inputFrameBuffer: OffscreenCanvas | HTMLCanvasElement | HTMLVideoElement | VideoFrame,
    outputFrameBuffer: HTMLCanvasElement
  ): Promise<void> | void;
}
