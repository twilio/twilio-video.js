import * as Video from './index';

function getAudioTrack(track: Video.LocalAudioTrack) {
  const localAudioTrack = track;
  localAudioTrack.attach();
  localAudioTrack.detach();
}

function getDataTrack(track: Video.LocalDataTrack) {
  const localDataTrack = track;
  localDataTrack.send('hello world');
}
