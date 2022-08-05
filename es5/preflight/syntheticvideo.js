"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syntheticVideo = void 0;
function syntheticVideo(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.width, width = _c === void 0 ? 640 : _c, _d = _b.height, height = _d === void 0 ? 480 : _d;
    var canvas = Object.assign(document.createElement('canvas'), { width: width, height: height });
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'green';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    var stopped = false;
    requestAnimationFrame(function animate() {
        if (!stopped) {
            // draw random rect/circle.
            var r = Math.round(Math.random() * 255);
            var g = Math.round(Math.random() * 255);
            var b = Math.round(Math.random() * 255);
            var a = Math.round(Math.random() * 255);
            ctx.fillStyle = "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
            ctx.fillRect(Math.random() * width, Math.random() * height, 50, 50);
            requestAnimationFrame(animate);
        }
    });
    var stream = canvas.captureStream(30);
    var track = stream.getTracks()[0];
    var originalStop = track.stop;
    track.stop = function () {
        stopped = true;
        originalStop.call(track);
    };
    return track;
}
exports.syntheticVideo = syntheticVideo;
//# sourceMappingURL=syntheticvideo.js.map