/**
 * @beta VideoFrame is part of Video Processor V3 support which is currently in beta.
 */
declare class VideoFrame {
  displayHeight: number;
  displayWidth: number;
  timestamp: number;
  constructor(videoSource: HTMLVideoElement);
  close(): void;
}

/**
 * A processor for manipulating video frames.
 * @beta Video Processor V3 support is currently in beta.
 */
export class VideoProcessor {
  /**
   * Process a video frame.
   * @param inputFrameBuffer The input frame buffer. Can be one of:
   * - OffscreenCanvas
   * - HTMLCanvasElement
   * - HTMLVideoElement
   * - VideoFrame (beta)
   * @param outputFrameBuffer The output frame buffer. The context type can be:
   * - '2d' (default)
   * - 'bitmaprenderer' (beta, Chromium-based browsers only)
   * @returns A Promise that resolves when the frame has been processed, or void for synchronous processing
   */
  processFrame(
    inputFrameBuffer: OffscreenCanvas | HTMLCanvasElement | HTMLVideoElement | VideoFrame,
    outputFrameBuffer: HTMLCanvasElement
  ): Promise<void> | void;
}
