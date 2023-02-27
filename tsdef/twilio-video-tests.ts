import * as Video from './index';

function customLogging() {
  const logger = Video.Logger.getLogger('twilio-video');

  const originalFactory = logger.methodFactory;
  logger.methodFactory = function(methodName, logLevel, loggerName) {
    const method = originalFactory(methodName, logLevel, loggerName);

    return function(dateTime, logLevel, component, message, data) {
      method(dateTime, logLevel, component, message, data);
    };
  };

  logger.setLevel('debug');
}

function getAudioTrack(track: Video.LocalAudioTrack) {
  let localAudioTrack: Video.LocalAudioTrack = track;

  localAudioTrack.attach('someEl');
  localAudioTrack.detach('someEl');

  localAudioTrack = localAudioTrack.disable().enable().stop();
  return localAudioTrack;
}

function getDataTrack(track: Video.LocalDataTrack) {
  const localDataTrack = track;
  localDataTrack.send('hello world');
}

function makeDataTrack() {
  const localTrackOptions: Video.LocalDataTrackOptions = { name: 'coolroom', logLevel: 'off' };
  const localDataTrack: Video.LocalDataTrack = new Video.LocalDataTrack(localTrackOptions);
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
    track.setPriority('high');
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
    track.setPriority('high');
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

let room: Video.Room | null = null;
let localVideoTrack: Video.LocalVideoTrack | null = null;
let localAudioTrack: Video.LocalAudioTrack | null = null;
let localTracks: Video.LocalTrack[] | null = null;

// Testing finally method
const maybeRoom = Video.connect('$TOKEN', {
  name: 'room-name',
  video: false,
  audio: false
}).then(room => {
  return room;
}).catch(err => {
  throw new Error(err);
}).finally(() => {
  return 'Finally happened!';
});

async function initRoom() {
  room = await Video.connect('$TOKEN', {
    name: 'room-name',
    video: false,
    audio: false,
    dominantSpeaker: true,
    networkQuality: true,
    region: 'au1',
    maxAudioBitrate: 500,
    maxVideoBitrate: 200,
    bandwidthProfile: {
      video: {
        clientTrackSwitchOffControl: 'auto',
        contentPreferencesMode: 'auto',
        dominantSpeakerPriority: 'high',
        renderDimensions: {
          low: {
            height: 500,
            width: null,
          },
        },
        trackSwitchOffMode: 'detected',
      },
    },
    preferredVideoCodecs: ['VP9', { codec: 'H264' }, { codec: 'VP8' }],
  });
  await Video.connect('$TOKEN', {
    networkQuality: {
      local: 3,
      remote: 1,
    },
  });

  // with manual contentPreferencesMode mode.
  await Video.connect('$TOKEN', {
    bandwidthProfile: {
      video: {
        contentPreferencesMode: 'manual',
        clientTrackSwitchOffControl: 'manual',
      }
    },
  });

  localVideoTrack = await Video.createLocalVideoTrack({ name: 'camera' });
  await localVideoTrack.restart({ facingMode: 'environment' });
  localAudioTrack = await Video.createLocalAudioTrack({ name: 'microphone' });
  await localAudioTrack.restart({ channelCount: 3 });
  room.localParticipant.publishTrack(localAudioTrack);
  room.participants.forEach(participantConnected);

  localTracks = await Video.createLocalTracks({ audio: true, video: false });
  await Video.createLocalTracks({ audio: true });
  await Video.connect('$TOKEN', {
    name: 'my-cool-room',
    tracks: localTracks
  });

  room.on('participantConnected', participantConnected);
  room.on('participantDisconnected', participantDisconnected);
  room.once('disconnected', (room: Video.Room, error: Video.TwilioError) => {
    room.participants.forEach(participantDisconnected);
    room.localParticipant.tracks.forEach((publication: Video.LocalTrackPublication) => {
      publication.unpublish();
      if (publication.track.kind !== 'data') { trackUnsubscribed(publication.track); }
    });
  });
}

function unpublishTracks() {
  if (room && localVideoTrack) { room.localParticipant.unpublishTrack(localVideoTrack); }
  if (room && localAudioTrack) { room.localParticipant.unpublishTrack(localAudioTrack); }
  if (room && localVideoTrack && localAudioTrack) { room.localParticipant.unpublishTracks([localVideoTrack, localAudioTrack]); }
}

function participantConnected(participant: Video.Participant) {
  participant.on('trackSubscribed', trackSubscribed);
  participant.on('trackUnsubscribed', trackUnsubscribed);

  participant.tracks.forEach(publication => {
    const remotePublication = publication as Video.RemoteTrackPublication;
    if (remotePublication.isSubscribed) {
      trackSubscribed(remotePublication.track as Video.VideoTrack | Video.AudioTrack);
    }
  });
}

function participantDisconnected(participant: Video.Participant) {
  participant.tracks.forEach(publication => {
    const remotePublication = publication as Video.RemoteTrackPublication;
    if (remotePublication.isSubscribed) {
      const { track } = remotePublication;
      if (track) { trackUnsubscribed(track as Video.AudioTrack | Video.VideoTrack); }
    }
  });
}

function trackSubscribed(track: Video.VideoTrack | Video.AudioTrack) {
  const media = track.attach();
  insertDomElement(media);
}

function trackUnsubscribed(track: Video.VideoTrack | Video.AudioTrack) {
  const element = document.createElement(track.kind);
  track.detach('#foo').remove();
  track.detach(element).remove();
  track.detach().forEach(element => element.remove());
}

function insertDomElement(element: HTMLMediaElement) {
  document.createElement('div');
  element.appendChild(element);
}

function useConnectionOptions() {
  const connectionOptions: Video.ConnectOptions = {
    dominantSpeaker: true,
    networkQuality: { local: 1, remote: 1 },
    maxAudioBitrate: Number('13000'),
    preferredAudioCodecs: [{  codec: 'opus', dtx: false }],
    preferredVideoCodecs: [{ codec: 'VP8', simulcast: false }],
  };
  return connectionOptions;
}

function useAdaptiveSimulcast() {
  const connectionOptions: Video.ConnectOptions = {
    preferredVideoCodecs: 'auto',
  };
}

function runPreflight() {
  const preflight: Video.PreflightTest = Video.runPreflight('token', { region: 'us1' });
  preflight.on('completed', (report: Video.PreflightTestReport) => {
    // eslint-disable-next-line no-console
    console.log('report ', report);
  });

  preflight.on('failed', (error: Error) => {
    // eslint-disable-next-line no-console
    console.log('error ', error);
  });

  preflight.on('progress', (progress: string) => {
    // eslint-disable-next-line no-console
    console.log('progress ', progress);
  });


  preflight.stop();
}

async function mediaWarnings() {
  let room = await Video.connect('$TOKEN', {
    notifyWarnings: []
  });
  room = await Video.connect('$TOKEN', {
    notifyWarnings: ['recording-media-lost']
  });

  room.localParticipant.tracks.forEach((publication: Video.LocalTrackPublication) => {
    publication.on('warning', (name: string) => {
      // eslint-disable-next-line no-console
      console.log(name);
    });
    publication.on('warningsCleared', () => {
      // eslint-disable-next-line no-console
      console.log('warningsCleared');
    });
  });
  room.localParticipant.on('trackWarning', (name: string, publication: Video.LocalTrackPublication) => {
    // eslint-disable-next-line no-console
    console.log(name, publication);
  });
  room.localParticipant.on('trackWarningsCleared', (publication: Video.LocalTrackPublication) => {
    // eslint-disable-next-line no-console
    console.log('warningsCleared', publication);
  });

  room.on('trackWarning', (name: string, publication: Video.LocalTrackPublication, participant: Video.LocalParticipant) => {
    // eslint-disable-next-line no-console
    console.log(name, publication, participant);
  });
  room.on('trackWarningsCleared', (publication: Video.LocalTrackPublication, participant: Video.LocalParticipant) => {
    // eslint-disable-next-line no-console
    console.log('warningsCleared', publication, participant);
  });
}

initRoom();
unpublishTracks();
runPreflight();
mediaWarnings();
