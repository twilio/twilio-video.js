/* globals VideoFrame */

'use strict';

const Benchmark = require('./benchmark');
const PersonMaskUpscalePipeline = require('./personmaskupscalepipeline');
const TwilioTFLite = require('./twiliotflite');

const inferenceWidth = 256;
const inferenceHeight = 144;

const personMask = new ImageData(
  inferenceWidth,
  inferenceHeight
);

let shouldUpdatePersonMask = true;

let benchmark;
let inferenceInputCanvas;
let inferenceInputContext;
let outputCanvas;
let outputContext;
let webgl2Canvas;
let personMaskUpscalePipeline;
let twilioTFLite;

function virtualBackgroundVideoFrame(
  frame,
  assetsPath,
  backgroundBitmap,
  maskBlurRadius,
  shouldDeferInputResize,
  shouldDebounce
) {
  const {
    displayHeight,
    displayWidth,
    timestamp
  } = frame;

  if (!outputCanvas) {
    outputCanvas = new OffscreenCanvas(
      displayWidth,
      displayHeight
    );
    outputContext = outputCanvas.getContext('2d');
  }
  if (!inferenceInputCanvas) {
    inferenceInputCanvas = new OffscreenCanvas(
      inferenceWidth,
      inferenceHeight
    );
    inferenceInputContext = inferenceInputCanvas
      .getContext(
        '2d',
        { willReadFrequently: true }
      );
  }
  if (!webgl2Canvas) {
    webgl2Canvas = new OffscreenCanvas(
      displayWidth,
      displayHeight
    );
  }
  if (!personMaskUpscalePipeline) {
    personMaskUpscalePipeline = new PersonMaskUpscalePipeline(
      {
        height: inferenceHeight,
        width: inferenceWidth
      },
      webgl2Canvas
    );
    personMaskUpscalePipeline.updateBilateralFilterConfig({
      sigmaSpace: maskBlurRadius
    });
  }
  if (!twilioTFLite) {
    twilioTFLite = new TwilioTFLite();
  }
  if (!benchmark) {
    benchmark = new Benchmark();
    setInterval(() => {
      const entry = {
        outputFrameRate: benchmark.getRate('totalProcessingDelay').toFixed(2)
      };
      [
        'captureFrameDelay',
        'imageCompositionDelay',
        'inputImageResizeDelay',
        'processFrameDelay',
        'segmentationDelay'
      ].forEach(name => {
        entry[name] = benchmark.getAverageDelay(name).toFixed(2);
      });
      // eslint-disable-next-line no-console
      console.log('Processor Stats:', entry);
    }, 2000);
  }

  return twilioTFLite.initialize(
    assetsPath,
    'selfie_segmentation_landscape.tflite',
    'tflite-1-0-0.js',
    'tflite-simd-1-0-0.js'
  ).then(() => {
    benchmark.end('captureFrameDelay');
    benchmark.start('processFrameDelay');
    benchmark.start('inputImageResizeDelay');

    const downscaleFrame = {
      false() {
        /* noop */
        return Promise.resolve();
      },
      true() {
        return createImageBitmap(frame, {
          resizeHeight: inferenceHeight,
          resizeQuality: 'pixelated',
          resizeWidth: inferenceWidth
        }).then(resizedFrameBitmap => {
          inferenceInputContext.drawImage(
            resizedFrameBitmap,
            0,
            0,
            inferenceWidth,
            inferenceHeight
          );
          resizedFrameBitmap.close();

          const { data } = inferenceInputContext.getImageData(
            0,
            0,
            inferenceWidth,
            inferenceHeight
          );
          twilioTFLite.loadInputBuffer(data);
        });
      }
    }[shouldUpdatePersonMask];

    const continueProcessing = () => {
      benchmark.end('inputImageResizeDelay');
      benchmark.start('segmentationDelay');

      const runInference = {
        false() {
          /* noop */
        },
        true() {
          twilioTFLite.runInference(personMask.data);
        }
      }[shouldUpdatePersonMask];

      // 2. Calculate the person mask.
      runInference();

      benchmark.end('segmentationDelay');
      benchmark.start('imageCompositionDelay');

      const upscalePersonMask = {
        false() {
          /* noop */
        },
        true() {
          personMaskUpscalePipeline.setInputTextureData(personMask);
          personMaskUpscalePipeline.render(frame);
        }
      }[shouldUpdatePersonMask];

      // 3. Upscale person mask.
      upscalePersonMask();

      shouldUpdatePersonMask = !(
        shouldDebounce
        && shouldUpdatePersonMask
      );

      // 4. Compose background blurred image.
      outputContext.save();

      // 4a. Draw upscaled person mask.
      outputContext.globalCompositeOperation = 'copy';
      outputContext.drawImage(
        webgl2Canvas,
        0,
        0,
        displayWidth,
        displayHeight
      );

      // 4b. Overlay the person onto the mask.

      outputContext.globalCompositeOperation = 'source-in';
      outputContext.drawImage(
        frame,
        0,
        0,
        displayWidth,
        displayHeight
      );

      // 4c. Draw the blurred background behind the person.
      outputContext.globalCompositeOperation = 'destination-over';
      outputContext.drawImage(
        backgroundBitmap,
        0,
        0,
        displayWidth,
        displayHeight
      );

      outputContext.restore();
      frame.close();

      benchmark.end('imageCompositionDelay');
      benchmark.end('processFrameDelay');
      benchmark.end('totalProcessingDelay');
      benchmark.start('totalProcessingDelay');
      benchmark.start('captureFrameDelay');

      return new VideoFrame(
        outputCanvas,
        { timestamp }
      );
    };

    // 1. Resize the input frame to inference dimensions.
    const resizePromise = downscaleFrame();

    return shouldDeferInputResize
      ? continueProcessing()
      : resizePromise.then(continueProcessing);
  });
}

module.exports = virtualBackgroundVideoFrame;
