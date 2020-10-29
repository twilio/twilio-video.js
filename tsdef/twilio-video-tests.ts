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

function RemoteParticipant(remoteParticipant: Video.RemoteParticipant) {
  const chatLog = document.getElementById('someElementChat');
  const RemoteData = remoteParticipant.dataTracks;
  const RemoteAudio = remoteParticipant.audioTracks;
  const sid = remoteParticipant.sid;

  const testDataTracks = remoteParticipant.dataTracks;

  remoteParticipant.on('disconnected', remoteParticipant => {
    return `${remoteParticipant} Has Disconnected`;
  });
  remoteParticipant.on('trackMessage', msg => {
    const textElement = document.createElement('p');
    if (chatLog) {
      textElement.innerText = `${msg}`;
      chatLog.appendChild(textElement);
    }
  });
  remoteParticipant.on('trackDimensionsChanged', videoTrack => {
    return `${videoTrack} has new track dimensions`;
  });
  remoteParticipant.on('trackDisabled', someTrack => {
    return `${someTrack} is now disabled`;
  });
  remoteParticipant.on('trackEnabled', someOtherTrack => {
    return `${someOtherTrack} is now disabled`;
  });
  remoteParticipant.on('trackPublished', publication => {
    const track = publication.track;
    return `${track} is now published`;
  });
  remoteParticipant.on('trackPublishPriorityChanged', (trackPriority, remotePublication) => {
    const remotePublicationPriority = remotePublication.publishPriority;
    return `${remotePublicationPriority} priorty is now ${trackPriority}`;
  });
  remoteParticipant.on('trackStarted', aTrack => {
    return `${aTrack} has started`;
  });
  remoteParticipant.on('trackSubscribed', (anotherTrack, anotherPublication) => {
    const track = anotherTrack.kind;
    const publicationSid = anotherPublication.trackSid;
    return `${track} track with ${publicationSid} is subscribed`;
  });
  remoteParticipant.on('trackSubscriptionFailed', (err, publication) => {
    throw err;
  });
  remoteParticipant.on('trackSwitchedOff', (yetAnotherTrack, yetAnotherPublication) => {
    const trackName = yetAnotherTrack.name;
    const publication = yetAnotherPublication.trackName;
    return `${trackName} is now switched off`;
  });
  remoteParticipant.on('trackSwitchedOn', (yetAnotherTrack, yetAnotherPublication) => {
    const trackName = yetAnotherTrack.name;
    const publication = yetAnotherPublication.trackName;
    return `${trackName} is now switched on`;
  });
  remoteParticipant.on('trackUnpublished', somePublication => {
    const publicationTrackName = somePublication.trackName;
    return `${publicationTrackName} is unpublished`;
  });
  remoteParticipant.on('trackUnsubscribed', (anotherTrack, anotherPublication) => {
    const publicationName = anotherPublication.trackName;
    return `${anotherTrack.name}, ${publicationName} has been unsubscribed`;
  });
}

function LocalParticipant(localParticipant: Video.LocalParticipant) {
  const LocalAudioTrack = localParticipant.audioTracks;
  const LocalDataTracks = localParticipant.dataTracks;
  const LocalVideoTrack = localParticipant.videoTracks;
  const LocalTracks = localParticipant.tracks;
  const signalingRegion = localParticipant.signalingRegion;

  localParticipant.on('disconnected', participant => {
    return `${participant.sid} has disconnected from the room`;
  });
  localParticipant.on('trackDimensionsChanged', videoTrack => {
    return `${videoTrack.name} dimensions have changed`;
  });
  localParticipant.on('trackDisabled', localTrack => {
    return `Muting ${localTrack.name}`;
  });
  localParticipant.on('trackEnabled', localTrack => {
    return `Unmute ${localTrack.name}`;
  });
  localParticipant.on('trackPublicationFailed', (error, track) => {
    return `There was a problem publishing track ${track} with error ${error}`;
  });
  localParticipant.on('trackPublished', publication => {
    return `Failed to publish ${publication.trackName}`;
  });
  localParticipant.on('trackStarted', track => {
    return `${track.name} has started`;
  });
  localParticipant.on('trackStopped', track => {
    return `${track.name} has stopped`;
  });
}
