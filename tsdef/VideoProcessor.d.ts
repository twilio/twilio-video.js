export class VideoProcessor {
  processFrame(inputFrame: OffscreenCanvas)
    : Promise<OffscreenCanvas | null>
    | OffscreenCanvas | null;
}
