'use strict';
function createAudioTrack() {
    // NOTE(mpatwardhan): We have to delay require-ing AudioContextFactory, because
    // it exports a default instance whose constructor calls Object.assign.
    var audioContextFactory = require('../webaudio/audiocontext');
    var holder = {};
    var audioContext = audioContextFactory.getOrCreate(holder);
    var oscillator = audioContext.createOscillator();
    var dst = oscillator.connect(audioContext.createMediaStreamDestination());
    oscillator.start();
    var track = dst.stream.getAudioTracks()[0];
    var originalStop = track.stop;
    track.stop = function () {
        originalStop.call(track);
        audioContextFactory.release(holder);
    };
    return track;
}
function createVideoTrack(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.width, width = _c === void 0 ? 640 : _c, _d = _b.height, height = _d === void 0 ? 480 : _d;
    var canvas = Object.assign(document.createElement('canvas'), { width: width, height: height });
    var ctx = canvas.getContext('2d');
    var stream = canvas.captureStream();
    var count = 0;
    var stopped = false;
    requestAnimationFrame(function animate() {
        if (!stopped) {
            ctx.fillStyle = "rgb(" + count % 255 + ", " + count * count % 255 + ", " + count % 255 + ")";
            count += 1;
            ctx.fillRect(0, 0, width, height);
            requestAnimationFrame(animate);
        }
    });
    var track = stream.getVideoTracks()[0];
    var originalStop = track.stop;
    track.stop = function () {
        stopped = true;
        originalStop.call(track);
    };
    return track;
}
module.exports = { createAudioTrack: createAudioTrack, createVideoTrack: createVideoTrack };
//# sourceMappingURL=synthetic.js.map