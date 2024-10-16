declare class VideoFrame {
  displayHeight: number;
  displayWidth: number;
  timestamp: number;
  constructor(videoSource: HTMLVideoElement);
  close(): void;
}

export class VideoProcessor {
  processFrame(
    inputFrameBuffer: OffscreenCanvas | HTMLCanvasElement | HTMLVideoElement | VideoFrame,
    outputFrameBuffer: HTMLCanvasElement
  ): Promise<void> | void;
}
