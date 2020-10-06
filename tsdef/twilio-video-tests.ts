/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Video from './index';

function getAudioTrack(track: Video.LocalAudioTrack) {
  const localAudioTrack = track;
  localAudioTrack.attach();
  localAudioTrack.detach();

  localAudioTrack.attach('someEl');
  localAudioTrack.detach('someEl');
}

function getDataTrack(track: Video.LocalDataTrack) {
  const localDataTrack = track;
  localDataTrack.send('hello world');
}

function getVideoTrack(track: Video.LocalVideoTrack) {
  const localVideoTrack = track;
  localVideoTrack.disable();
  localVideoTrack.enable();
  localVideoTrack.restart();
  localVideoTrack.stop();

  localVideoTrack.on('disabled', track => {
    track.detach();
  });
  localVideoTrack.on('enabled', track => {
    track.attach();
  });
}
