"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syntheticAudio = syntheticAudio;
function syntheticAudio() {
    // NOTE(mpatwardhan): We have to delay require-ing AudioContextFactory, because
    // it exports a default instance whose constructor calls Object.assign.
    const audioContextFactory = require('../webaudio/audiocontext');
    const holder = {};
    const audioContext = audioContextFactory.getOrCreate(holder);
    const oscillator = audioContext.createOscillator();
    const dst = oscillator.connect(audioContext.createMediaStreamDestination());
    oscillator.start();
    const track = dst.stream.getAudioTracks()[0];
    const originalStop = track.stop;
    track.stop = () => {
        originalStop.call(track);
        audioContextFactory.release(holder);
    };
    return track;
}
//# sourceMappingURL=syntheticaudio.js.map