export class VideoProcessor {
  processFrame(inputFrame: HTMLCanvasElement | OffscreenCanvas)
    : Promise<HTMLCanvasElement | OffscreenCanvas | null>
    | HTMLCanvasElement | OffscreenCanvas | null;
}
