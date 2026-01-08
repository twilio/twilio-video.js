"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syntheticAudio = syntheticAudio;
function syntheticAudio() {
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
//# sourceMappingURL=syntheticaudio.js.map