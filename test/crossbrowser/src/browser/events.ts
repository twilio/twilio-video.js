import DMP from '../../../lib/sdkdriver/src/dmp';

import {
  add,
  remove
} from './resources';

import {
  serializeLocalParticipant,
  serializeLocalTrack,
  serializeLocalTrackPublication,
  serializeParticipant,
  serializeRemoteTrack,
  serializeRoom
} from './serialize';

/**
 * Send {@link MediaTrack} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {MediaTrack} mediaTrack
 * @param {(mediaTrack: any) => any} serializeMediaTrack
 * @returns {void}
 */
function sendMediaTrackEvents(dmp: DMP, mediaTrack: any, serializeMediaTrack: (mediaTrack: any) => any): void {
  ['disabled', 'enabled', 'started'].forEach((event: string) => {
    mediaTrack.on(event, () => {
      dmp.sendEvent({
        source: serializeMediaTrack(mediaTrack),
        type: event
      });
    });
  });
}

/**
 * Send {@link LocalMediaTrack} events to the {@link SDKDriver}
 * @param {DMP} dmp
 * @param {LocalMediaTrack} localMediaTrack
 * @returns {void}
 */
function sendLocalMediaTrackEvents(dmp: DMP, localMediaTrack: any): void {
  sendMediaTrackEvents(dmp, localMediaTrack, serializeLocalTrack);
  localMediaTrack.on('stopped', () => {
    dmp.sendEvent({
      source: serializeLocalTrack(localMediaTrack),
      type: 'stopped'
    });
  });
}

/**
 * Send {@link RemoteDataTrack} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {RemoteDataTrack} remoteDataTrack
 * @returns {void}
 */
function sendRemoteDataTrackEvents(dmp: DMP, remoteDataTrack: any): void {
  remoteDataTrack.on('message', (data: string) => {
    dmp.sendEvent({
      args: [data],
      source: serializeRemoteTrack(remoteDataTrack),
      type: 'message'
    });
  });
}

/**
 * Send {@link RemoteTrack} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {RemoteTrack} remoteTrack
 * @returns {void}
 */
function sendRemoteTrackEvents(dmp: DMP, remoteTrack: any): void {
  add(remoteTrack);

  if (remoteTrack.kind === 'data') {
    sendRemoteDataTrackEvents(dmp, remoteTrack);
  } else {
    sendMediaTrackEvents(dmp, remoteTrack, serializeRemoteTrack);
  }

  remoteTrack.on('unsubscribed', () => {
    dmp.sendEvent({
      source: serializeRemoteTrack(remoteTrack),
      type: 'unsubscribed'
    });
  });
}

/**
 * Send {@link LocalParticipant} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {LocalParticipant} localParticipant
 * @returns {void}
 */
function sendLocalParticipantEvents(dmp: DMP, localParticipant: any): void {
  add(localParticipant);

  localParticipant.tracks.forEach((track: any) => {
    sendLocalTrackEvents(dmp, track);
  });

  localParticipant.on('trackAdded', (track: any) => {
    sendLocalTrackEvents(dmp, track);
    dmp.sendEvent({
      args: [serializeLocalTrack(track)],
      source: serializeLocalParticipant(localParticipant),
      type: 'trackAdded'
    });
  });

  localParticipant.on('trackPublicationFailed', (error: any, track: any) => {
    const { code, message } = error;
    dmp.sendEvent({
      args: [{ code, message }, serializeLocalTrack(track)],
      source: serializeLocalParticipant(localParticipant),
      type: 'trackPublicationFailed'
    });
  });

  localParticipant.on('trackPublished', (publication: any) => {
    add(publication);
    dmp.sendEvent({
      args: [serializeLocalTrackPublication(publication)],
      source: serializeLocalParticipant(localParticipant),
      type: 'trackPublished'
    });
  });

  localParticipant.on('trackRemoved', (track: any) => {
    dmp.sendEvent({
      args: [serializeLocalTrack(track)],
      source: serializeLocalParticipant(localParticipant),
      type: 'trackRemoved'
    });
  });
}

/**
 * Send {@link RemoteParticipant} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {RemoteParticipant} participant
 * @returns {void}
 */
function sendParticipantEvents(dmp: DMP, participant: any): void {
  add(participant);

  participant.tracks.forEach((track: any) => {
    sendRemoteTrackEvents(dmp, track);
  });

  participant.on('disconnected', () => {
    dmp.sendEvent({
      source: serializeParticipant(participant),
      type: 'disconnected'
    });
  });

  participant.on('trackAdded', (track: any) => {
    sendRemoteTrackEvents(dmp, track);
    dmp.sendEvent({
      args: [serializeRemoteTrack(track)],
      source: serializeParticipant(participant),
      type: 'trackAdded'
    });
  });

  participant.on('trackDisabled', (track: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track)],
      source: serializeParticipant(participant),
      type: 'trackDisabled'
    });
  });

  participant.on('trackEnabled', (track: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track)],
      source: serializeParticipant(participant),
      type: 'trackEnabled'
    });
  });

  participant.on('trackMessage', (data: string, track: any) => {
    dmp.sendEvent({
      args: [data, serializeRemoteTrack(track)],
      source: serializeParticipant(participant),
      type: 'trackMessage'
    });
  });

  participant.on('trackRemoved', (track: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track)],
      source: serializeParticipant(participant),
      type: 'trackRemoved'
    });
  });

  participant.on('trackStarted', (track: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track)],
      source: serializeParticipant(participant),
      type: 'trackStarted'
    });
  });

  participant.on('trackSubscribed', (track: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track)],
      source: serializeParticipant(participant),
      type: 'trackSubscribed'
    });
  });

  participant.on('trackUnsubscribed', (track: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track)],
      source: serializeParticipant(participant),
      type: 'trackUnsubscribed'
    });
  });
}

/**
 * Send {@link LocalTrack} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {LocalTrack} localTrack
 * @returns {void}
 */
export function sendLocalTrackEvents(dmp: DMP, localTrack: any): void {
  add(localTrack);
  if (localTrack.kind !== 'data') {
    sendLocalMediaTrackEvents(dmp, localTrack);
  }
}

/**
 * Send {@link Room} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {Room} room
 * @returns {void}
 */
export function sendRoomEvents(dmp: DMP, room: any): void {
  add(room);
  sendLocalParticipantEvents(dmp, room.localParticipant);

  room.participants.forEach((participant: any) => {
    sendParticipantEvents(dmp, participant);
  });

  room.on('disconnected', (room: any, error: any) => {
    const serializedError = error ? {
      code: error.code,
      message: error.message
    } : null;
    const serializedRoom = serializeRoom(room);

    dmp.sendEvent({
      args: [serializedRoom, serializedError],
      source: serializedRoom,
      type: 'disconnected'
    });

    room.participants.forEach((participant: any) => {
      participant.tracks.forEach(remove);
      remove(participant);
    });

    room.localParticipant.tracks.forEach(remove);
    remove(room.localParticipant);
    remove(room);
  });

  room.on('participantConnected', (participant: any) => {
    sendParticipantEvents(dmp, participant);
    dmp.sendEvent({
      args: [serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'participantConnected'
    });
  });

  room.on('participantDisconnected', (participant: any) => {
    dmp.sendEvent({
      args: [serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'participantDisconnected'
    });
    participant.tracks.forEach(remove);
    remove(participant);
  });

  room.on('recordingStarted', () => {
    const serializedRoom = serializeRoom(room);
    dmp.sendEvent({
      args: [serializedRoom],
      source: serializedRoom,
      type: 'recordingStarted'
    });
  });

  room.on('recordingStopped', () => {
    const serializedRoom = serializeRoom(room);
    dmp.sendEvent({
      args: [serializedRoom],
      source: serializedRoom,
      type: 'recordingStopped'
    });
  });

  room.on('trackAdded', (track: any, participant: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'trackAdded'
    });
  });

  room.on('trackDisabled', (track: any, participant: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'trackDisabled'
    });
  });

  room.on('trackEnabled', (track: any, participant: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'trackEnabled'
    });
  });

  room.on('trackMessage', (data: string, track: any, participant: any) => {
    dmp.sendEvent({
      args: [data, serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'trackMessage'
    });
  });

  room.on('trackRemoved', (track: any, participant: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'trackRemoved'
    });
    remove(track);
  });

  room.on('trackStarted', (track: any, participant: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'trackStarted'
    });
  });

  room.on('trackSubscribed', (track: any, participant: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'trackSubscribed'
    });
  });

  room.on('trackUnsubscribed', (track: any, participant: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'trackUnsubscribed'
    });
  });
}
