/* globals MediaStreamTrackGenerator, MediaStreamTrackProcessor, TransformStream */
'use strict';
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var DEFAULT_FRAME_RATE = require('../../util/constants').DEFAULT_FRAME_RATE;
function captureVideoFramesSetInterval(videoEl, processVideoFrame) {
    var _a = __read(videoEl.srcObject.getVideoTracks(), 1), track = _a[0];
    var _b = track.getSettings().frameRate, frameRate = _b === void 0 ? DEFAULT_FRAME_RATE : _b;
    var sampleInterval;
    var readable = new ReadableStream({
        start: function (controller) {
            sampleInterval = setInterval(function () { return controller.enqueue(); }, 1000 / frameRate);
        }
    });
    var transformer = new TransformStream({
        transform: function () {
            return processVideoFrame();
        }
    });
    readable
        .pipeThrough(transformer)
        .pipeTo(new WritableStream())
        .then(function () { });
    return function () {
        clearInterval(sampleInterval);
    };
}
function captureVideoFramesInsertableStreams(videoEl, processVideoFrame, videoFrameType) {
    var _a = __read(videoEl.srcObject.getVideoTracks(), 1), track = _a[0];
    var readable = new MediaStreamTrackProcessor({ track: track }).readable;
    var generator = new MediaStreamTrackGenerator({ kind: 'video' });
    var shouldStop = false;
    var transformer = new TransformStream({
        transform: function (videoFrame, controller) {
            var promise = videoFrameType === 'videoframe'
                ? processVideoFrame(videoFrame)
                : Promise.resolve(videoFrame.close())
                    .then(processVideoFrame);
            return promise.finally(function () {
                if (shouldStop) {
                    controller.terminate();
                }
            });
        }
    });
    readable
        .pipeThrough(transformer)
        .pipeTo(generator.writable)
        .then(function () { });
    return function () {
        shouldStop = true;
    };
}
module.exports = typeof MediaStreamTrackGenerator === 'function' && typeof MediaStreamTrackProcessor === 'function'
    ? captureVideoFramesInsertableStreams
    : captureVideoFramesSetInterval;
//# sourceMappingURL=capturevideoframes.js.map