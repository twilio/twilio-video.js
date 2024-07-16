'use strict';

const { expose, transfer } = require('comlink');
const virtualBackgroundVideoFrame = require('./virtualbackgroundvideoframe');

let assetsPath;
let backgroundBitmap;
let maskBlurRadius;
let maskBlurStepFactor;
let shouldDeferInputResize;
let shouldDebounce;

function initialize(
  assetsPath_,
  backgroundBitmap_,
  maskBlurRadius_,
  maskBlurStepFactor_,
  shouldDeferInputResize_,
  shouldDebounce_
) {
  assetsPath = assetsPath_;
  backgroundBitmap = backgroundBitmap_;
  maskBlurRadius = maskBlurRadius_;
  maskBlurStepFactor = maskBlurStepFactor_;
  shouldDeferInputResize = shouldDeferInputResize_;
  shouldDebounce = shouldDebounce_;
}

function processFrame(frame) {
  return virtualBackgroundVideoFrame(
    frame,
    assetsPath,
    backgroundBitmap,
    maskBlurRadius,
    maskBlurStepFactor,
    shouldDeferInputResize,
    shouldDebounce
  ).then(processedFrame => transfer(
    processedFrame,
    [processedFrame]
  ));
}

expose({
  initialize,
  processFrame
});
