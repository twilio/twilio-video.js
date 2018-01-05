import DMP from '../../../lib/sdkdriver/src/dmp';

import {
  serializeParticipant,
  serializeRoom
} from './serialize';

/**
 * Send {@link Room} events to the {@link SDKDriver}.
 * @param {DMP} dmp
 * @param {number} instanceId
 * @param {Room} room
 * @returns {void}
 */
export function sendRoomEvents(dmp: DMP, instanceId: number, room: any): void {
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
}
