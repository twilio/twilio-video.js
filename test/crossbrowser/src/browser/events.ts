import DMP from '../../../lib/sdkdriver/src/dmp';

import {
  serializeLocalParticipant,
  serializeLocalTrack,
  serializeLocalTrackPublication,
  serializeParticipant,
  serializeRemoteTrack,
  serializeRoom
} from './serialize';

function sendLocalParticipantEvents(dmp: DMP, localParticipant: any): void {
  localParticipant.on('trackPublicationFailed', (error: any, localTrack: any) => {
    const { code, message } = error;
    dmp.sendEvent({
      args: [{ code, message }, serializeLocalTrack(localTrack)],
      source: serializeLocalParticipant(localParticipant),
      type: 'trackPublicationFailed'
    });
  });

  localParticipant.on('trackPublished', (publication: any) => {
    dmp.sendEvent({
      args: [serializeLocalTrackPublication(publication)],
      source: serializeLocalParticipant(localParticipant),
      type: 'trackPublished'
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
  });

  participant.on('trackAdded', (track: any) => {
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
 * Send {@link Room} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {number} instanceId
 * @param {Room} room
 * @returns {void}
 */
export function sendRoomEvents(dmp: DMP, instanceId: number, room: any): void {
  room.participants.forEach((participant: any) => {
    sendParticipantEvents(dmp, participant);
  });
  sendLocalParticipantEvents(dmp, room.localParticipant);

  room.on('disconnected', (room: any, error: any) => {
    const serializedError: any = error ? {
      code: error.code,
      message: error.message
    } : null;
    const serializedRoom: any = {
      _instanceId: instanceId,
      ...serializeRoom(room)
    };
    dmp.sendEvent({
      args: [serializedRoom, serializedError],
      source: serializedRoom,
      type: 'disconnected'
    });
  });

  room.on('participantConnected', (participant: any) => {
    const serializedRoom: any = {
      _instanceId: instanceId,
      ...serializeRoom(room)
    };
    sendParticipantEvents(dmp, participant);
    dmp.sendEvent({
      args: [serializeParticipant(participant)],
      source: serializedRoom,
      type: 'participantConnected'
    });
  });

  room.on('participantDisconnected', (participant: any) => {
    const serializedRoom: any = {
      _instanceId: instanceId,
      ...serializeRoom(room)
    };
    dmp.sendEvent({
      args: [serializeParticipant(participant)],
      source: serializedRoom,
      type: 'participantDisconnected'
    });
  });

  room.on('recordingStarted', () => {
    const serializedRoom: any = {
      _instanceId: instanceId,
      ...serializeRoom(room)
    };
    dmp.sendEvent({
      args: [serializedRoom],
      source: serializedRoom,
      type: 'recordingStarted'
    });
  });

  room.on('recordingStopped', () => {
    const serializedRoom: any = {
      _instanceId: instanceId,
      ...serializeRoom(room)
    };
    dmp.sendEvent({
      args: [serializedRoom],
      source: serializedRoom,
      type: 'recordingStopped'
    });
  });

  room.on('trackAdded', (track: any, participant: any) => {
    const serializedRoom: any = {
      _instanceId: instanceId,
      ...serializeRoom(room)
    };
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializedRoom,
      type: 'trackAdded'
    });
  });

  room.on('trackRemoved', (track: any, participant: any) => {
    const serializedRoom: any = {
      _instanceId: instanceId,
      ...serializeRoom(room)
    };
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializedRoom,
      type: 'trackRemoved'
    });
  });

  room.on('trackSubscribed', (track: any, participant: any) => {
    const serializedRoom: any = {
      _instanceId: instanceId,
      ...serializeRoom(room)
    };
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializedRoom,
      type: 'trackSubscribed'
    });
  });

  room.on('trackUnsubscribed', (track: any, participant: any) => {
    const serializedRoom: any = {
      _instanceId: instanceId,
      ...serializeRoom(room)
    };
    dmp.sendEvent({
      args: [serializeRemoteTrack(track), serializeParticipant(participant)],
      source: serializedRoom,
      type: 'trackUnsubscribed'
    });
  });
}
