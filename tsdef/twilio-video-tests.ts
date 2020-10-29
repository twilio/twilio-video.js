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

  const testDataTracks = RemoteParticipant.dataTracks;

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
  RemoteParticipant.on('trackDimensionsChanged', videoTrack => {
    return `${videoTrack} has new track dimensions`;
  });
  RemoteParticipant.on('trackDisabled', someTrack => {
    return `${someTrack} is now disabled`;
  });
  RemoteParticipant.on('trackEnabled', someOtherTrack => {
    return `${someOtherTrack} is now disabled`;
  });
  RemoteParticipant.on('trackPublished', publication => {
    const track = publication.track;
    return `${track} is now published`;
  });
  RemoteParticipant.on('trackPublishPriorityChanged', (trackPriority, remotePublication) => {
    const remotePublicationPriority = remotePublication.publishPriority;
    return `${remotePublicationPriority} priorty is now ${trackPriority}`;
  });
  RemoteParticipant.on('trackStarted', aTrack => {
    return `${aTrack} has started`;
  });
  RemoteParticipant.on('trackSubscribed', (anotherTrack, anotherPublication) => {
    const track = anotherTrack.kind;
    const publicationSid = anotherPublication.trackSid;
    return `${track} track with ${publicationSid} is subscribed`;
  });
  RemoteParticipant.on('trackSubscriptionFailed', (err, publication) => {
    throw err;
  });
  RemoteParticipant.on('trackSwitchedOff', (yetAnotherTrack, yetAnotherPublication) => {
    const trackName = yetAnotherTrack.name;
    const publication = yetAnotherPublication.trackName;
    return `${trackName} is now switched off`;
  });
  RemoteParticipant.on('trackSwitchedOn', (yetAnotherTrack, yetAnotherPublication) => {
    const trackName = yetAnotherTrack.name;
    const publication = yetAnotherPublication.trackName;
    return `${trackName} is now switched on`;
  });
  RemoteParticipant.on('trackUnpublished', somePublication => {
    const publicationTrackName = somePublication.trackName;
    return `${publicationTrackName} is unpublished`;
  });
  RemoteParticipant.on('trackUnsubscribed', (anotherTrack, anotherPublication) => {
    const publicationName = anotherPublication.trackName;
    return `${anotherTrack.name}, ${publicationName} has been unsubscribed`;
  });
}

function LocalParticipant(LocalParticipant: Video.LocalParticipant) {
  const LocalAudioTrack = LocalParticipant.audioTracks;
  const LocalDataTracks = LocalParticipant.dataTracks;
  const LocalVideoTrack = LocalParticipant.videoTracks;
  const LocalTracks = LocalParticipant.tracks;
  const signalingRegion = LocalParticipant.signalingRegion;

  LocalParticipant.on('disconnected', participant => {
    return `${participant.sid} has disconnected from the room`;
  });
  LocalParticipant.on('trackDimensionsChanged', videoTrack => {
    return `${videoTrack.name} dimensions have changed`;
  });
  LocalParticipant.on('trackDisabled', localTrack => {
    return `Muting ${localTrack.name}`;
  });
  LocalParticipant.on('trackEnabled', localTrack => {
    return `Unmute ${localTrack.name}`;
  });
  LocalParticipant.on('trackPublicationFailed', (error, track) => {
    return `There was a problem publishing track ${track} with error ${error}`;
  });
  LocalParticipant.on('trackPublished', publication => {
    return `Failed to publish ${publication.trackName}`;
  });
  LocalParticipant.on('trackStarted', track => {
    return `${track.name} has started`;
  });
  LocalParticipant.on('trackStopped', track => {
    return `${track.name} has stopped`;
  });
}
