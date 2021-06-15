
'use strict';
function createAudioTrack() {
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

function createVideoTrack({ width = 640, height = 480 } = {}) {
  const canvas = Object.assign(
    document.createElement('canvas'), { width, height }
  );
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream();

  let count = 0;
  let stopped = false;
  requestAnimationFrame(function animate() {
    if (!stopped) {
      ctx.fillStyle = `rgb(${count % 255}, ${count * count % 255}, ${count % 255})`;
      count += 1;
      ctx.fillRect(0, 0, width, height);
      requestAnimationFrame(animate);
    }
  });

  const track =  stream.getVideoTracks()[0];
  const originalStop = track.stop;
  track.stop = () => {
    stopped = true;
    originalStop.call(track);
  };

  return track;
}
module.exports = { createAudioTrack, createVideoTrack };
