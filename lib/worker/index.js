'use strict';

const { expose } = require('comlink');
const virtualBackgroundVideoFrame = require('./virtualbackgroundvideoframe');
const processVideoMediaStreamTrack = require('./processvideomediastreamtrack');

function virtualBackground(
  readable,
  writable,
  assetsPath,
  backgroundBitmap,
  maskBlurRadius,
  shouldDeferInputResize,
  shouldDebounce
) {
  processVideoMediaStreamTrack(
    readable,
    writable,
    frame => virtualBackgroundVideoFrame(
      frame,
      assetsPath,
      backgroundBitmap,
      maskBlurRadius,
      shouldDeferInputResize,
      shouldDebounce
    )
  );
}

expose({
  virtualBackground
});
