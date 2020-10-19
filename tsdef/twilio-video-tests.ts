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

function remoteVideoTrackPublication(publication: Video.RemoteVideoTrackPublication) {
  publication.on('subscriptionFailed', error => {
    throw error;
  });
  publication.on('subscribed', track => {
    track.attach('someOtherEl');
  });
  publication.on('trackSwitchedOff', track => {
    track.detach('someOtherEl');
  });
  publication.on('unsubscribed', track => {
    track.detach('someOtherEl');
  });
  publication.on('s', () => {
    return 'this should build';
  });
}

function remoteAudioTrackPublication(publication: Video.RemoteAudioTrackPublication) {
  const track = publication.track;
  publication.on('subscriptionFailed', error => {
    throw error;
  });
  publication.on('subscribed', track => {
    track.attach('someOtherEl');
  });
  publication.on('trackDisabled', () => {
    if (track) {
      track.detach('someOtherEl');
    }
  });
  publication.on('unsubscribed', track => {
    track.detach('someOtherEl');
  });
  publication.on('s', () => {
    return 'this should build';
  });
}

function remoteDataTrackPublication(publication: Video.RemoteDataTrackPublication) {
  const chatLog = document.getElementById('someElementChat');
  publication.on('subscribed', track => {
    track.on('message', msg => {
      const textElement = document.createElement('p');
      if (chatLog) {
        textElement.innerText = `${msg}`;
        chatLog.appendChild(textElement);
      }
    });
  });

}

function localAudioTrackPublication(publication: Video.LocalAudioTrackPublication) {
  const kind = publication.kind;
  const track = publication.track;
  const publicationInfo = { kind, track };
  return publicationInfo;
}

function localVideoTrackPublication(publication: Video.LocalVideoTrackPublication) {
  const kind = publication.kind;
  const track = publication.track;
  const publicationInfo = { kind, track };
  return publicationInfo;
}

function localDataTrackPublication(publication: Video.LocalDataTrackPublication) {
  const kind = publication.kind;
  const track = publication.track;
  const publicationInfo = { kind, track };
  return publicationInfo;
}

function RemoteParticipant(RemoteParticipant: Video.RemoteParticipant) {
  const chatLog = document.getElementById('someElementChat');
  const RemoteData = RemoteParticipant.dataTracks;
  const RemoteAudio = RemoteParticipant.audioTracks;
  const sid = RemoteParticipant.sid;

  RemoteParticipant.on('disconnected', remoteParticipant => {
    return `${remoteParticipant} Has Disconnected`;
  });
  RemoteParticipant.on('trackMessage', msg => {
    const textElement = document.createElement('p');
    if (chatLog) {
      textElement.innerText = `${msg}`;
      chatLog.appendChild(textElement);
    }
  });
}

function LocalParticipant(LocalParticipant: Video.LocalParticipant) {
  const LocalAudioTrack = LocalParticipant.audioTracks;
  const LocalVideoTrack = LocalParticipant.videoTracks;
  const LocalTracks = LocalParticipant.tracks;
  const signalingRegion = LocalParticipant.signalingRegion;

  LocalParticipant.on('networkQualityLevelChanged', (networkQualityLevel, networkQualityStats) => {
    return `Your network quality level has changed to : ${networkQualityLevel}`;
  });
  LocalParticipant.on('trackPublicationFailed', (error, track) => {
    return `There was a problem publishing track ${track} with error ${error}`;
  });
}
