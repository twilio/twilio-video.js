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
 * Send {@link LocalParticipant} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {LocalParticipant} localParticipant
 */
function sendLocalParticipantEvents(dmp: DMP, localParticipant: any): void {
  localParticipant.on('trackAdded', (track: any) => {
    dmp.sendEvent({
      args: [serializeLocalTrack(track)],
      source: serializeLocalParticipant(localParticipant),
      type: 'localTrackAdded'
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
      type: 'localTrackRemoved'
    });
  });
}

/**
 * Send {@link RemoteParticipant} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {RemoteParticipant} participant
 */
function sendParticipantEvents(dmp: DMP, participant: any): void {
  participant.on('disconnected', () => {
    dmp.sendEvent({
      source: serializeParticipant(participant),
      type: 'disconnected'
    });
    remove(participant);
  });

  participant.on('trackAdded', (track: any) => {
    add(track);
    dmp.sendEvent({
      args: [serializeRemoteTrack(track)],
      source: serializeParticipant(participant),
      type: 'trackAdded'
    });
  });

  participant.on('trackRemoved', (track: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track)],
      source: serializeParticipant(participant),
      type: 'trackRemoved'
    });
    remove(track);
  });

  participant.on('trackSubscribed', (track: any) => {
    add(track);
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
    remove(track);
  });
}

/**
 * Send {@link Room} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {Room} room
 * @returns {void}
 */
export function sendRoomEvents(dmp: DMP, room: any): void {
  room.participants.forEach((participant: any) => {
    sendParticipantEvents(dmp, participant);
  });
  sendLocalParticipantEvents(dmp, room.localParticipant);

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
    remove(room);
  });

  room.on('participantConnected', (participant: any) => {
    add(participant);
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

  room.on('trackRemoved', (track: any, participant: any) => {
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializeRoom(room),
      type: 'trackRemoved'
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
