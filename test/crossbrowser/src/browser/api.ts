import {
  serializeLocalParticipant,
  serializeLocalTrack,
  serializeLocalTrackPublication,
  serializeRoom
} from './serialize';

declare const Twilio: any;

const localTracks: Map<string, any> = new Map();
const rooms: Map<number, any> = new Map();

let connectAttempt = 0;

/**
 * Connect to a {@link Room}.
 * @param {Array<*>} args
 * @param {(instanceId: number, room: Room) => void} sendRoomEvents
 * @returns {Promise<object>}
 */
export async function connect(args: any, sendRoomEvents: (instanceId: number, room: any) => void): Promise<any> {
  const [ token, options ] = args;
  let room: any;

  try {
    room = await Twilio.Video.connect(token, options);
  } catch (e) {
    return {
      error: {
        code: e.code,
        message: e.message
      }
    };
  }

  sendRoomEvents(connectAttempt, room);
  room.localParticipant.tracks.forEach((track: any) => localTracks.set(track.id, track));
  rooms.set(connectAttempt, room);

  return {
    result: {
      _instanceId: connectAttempt++,
      ...serializeRoom(room)
    }
  };
}

/**
 * Create a {@link LocalTrack}.
 * @param {Array<*>} args
 * @returns {Promise<object>}
 */
export async function createLocalTrack(args: any): Promise<any> {
  const [ kind, options ] = args;
  const createLocalTrack: (options: any) => Promise<any> = {
    audio: (options: any) => Twilio.Video.createLocalAudioTrack(options),
    data: (options: any) => new Twilio.Video.LocalDataTrack(options),
    video: (options: any) => Twilio.Video.createLocalVideoTrack(options)
  }[kind];
  let localTrack: any;

  try {
    localTrack = await createLocalTrack(options);
  } catch (e) {
    return {
      error: {
        message: e.message
      }
    };
  }
  localTracks.set(localTrack.id, localTrack);
  return {
    result: serializeLocalTrack(localTrack)
  };
}

/**
 * Create an array of {@link LocalTrack}s.
 * @param {Array<*>} args
 * @returns {Promise<object>}
 */
export async function createLocalTracks(args: any): Promise<any> {
  const [ options ] = args;
  let localTracksArray: any;

  try {
    localTracksArray = await Twilio.Video.createLocalTracks(options);
  } catch (e) {
    return {
      error: {
        message: e.message
      }
    };
  }
  localTracksArray.forEach((track: any) => localTracks.set(track.id, track));
  return {
    result: localTracksArray.map((track: any) => serializeLocalTrack(track))
  };
}

/**
 * Disconnect from a {@link Room}.
 * @param {number} target - Instance ID of the {@link Room}
 * @returns {object}
 */
export function disconnect(target: number): any {
  const room: any = rooms.get(target);
  if (!room) {
    return {
      error: {
        message: 'Room not found'
      }
    };
  }
  room.disconnect();
  rooms.delete(target);

  return {
    result: {
      _instanceId: target,
      ...serializeRoom(room)
    }
  };
}

/**
 * Get {@link Room} stats.
 * @param {number} target - Instance ID of the {@link Room}.
 * @returns {Promise<object>}
 */
export async function getStats(target: number): Promise<any> {
  const room: any = rooms.get(target);
  if (!room) {
    return {
      error: {
        message: 'Room not found'
      }
    };
  }

  try {
    return {
      result: await room.getStats()
    };
  } catch (e) {
    return {
      error : {
        message: e.message
      }
    };
  }
}

/**
 * Publish a {@link LocalTrack} to a {@link Room}.
 * @param {string} target - {@link LocalParticipant} SID
 * @param {Array<*>} args
 * @returns {Promise<object>}
 */
export async function publishTrack(target: string, args: any): Promise<any> {
  const localParticipants: Map<string, any> = new Map();
  rooms.forEach((room: any) => localParticipants.set(room.localParticipant.sid, room.localParticipant));

  const localParticipant: any = localParticipants.get(target);
  if (!localParticipant) {
    return {
      error: {
        message: 'Participant not found'
      }
    };
  }

  const localTrack: any = localTracks.get(args[0]);
  if (!localTrack) {
    return {
      error: {
        message: 'LocalTrack not found'
      }
    };
  }

  let localTrackPublication: any;
  try {
    localTrackPublication = await localParticipant.publishTrack(localTrack);
  } catch (e) {
    return {
      error: {
        code: e.code,
        message: e.message
      }
    };
  }

  return {
    result: serializeLocalTrackPublication(localTrackPublication)
  };
}

/**
 * Publish {@link LocalTrack}s to a {@link Room}.
 * @param {string} target - {@link LocalParticipant} SID
 * @param {Array<*>} args
 * @returns {Promise<object>}
 */
export async function publishTracks(target: string, args: any): Promise<any> {
  const localParticipants: Map<string, any> = new Map();
  rooms.forEach((room: any) => localParticipants.set(room.localParticipant.sid, room.localParticipant));

  const localParticipant: any = localParticipants.get(target);
  if (!localParticipant) {
    return {
      error: {
        message: 'Participant not found'
      }
    };
  }

  const localTracksToPublish: any = args[0].map((trackId: string) => localTracks.get(trackId));
  if (localTracksToPublish.some((localTrack: any) => !localTrack)) {
    return {
      error: {
        message: 'Some LocalTracks not found'
      }
    };
  }

  let localTrackPublications: any;
  try {
    localTrackPublications = await localParticipant.publishTracks(localTracksToPublish);
  } catch (e) {
    return {
      error: {
        code: e.code,
        message: e.message
      }
    };
  }

  return {
    result: localTrackPublications.map(serializeLocalTrackPublication)
  };
}

/**
 * Set the {@link LocalParticipant}'s {@link EncodingParameters}.
 * @param {string} target - {@link LocalParticipant} SID
 * @param {Array<*>} args
 * @returns {object}
 */
export function setParameters(target: string, args: any): any {
  const localParticipants: Map<string, any> = new Map();
  rooms.forEach((room: any) => localParticipants.set(room.localParticipant.sid, room.localParticipant));

  const localParticipant: any = localParticipants.get(target);
  if (!localParticipant) {
    return {
      error: {
        message: 'Participant not found'
      }
    };
  }

  const encodingParameters: any = args[0];
  try {
    localParticipant.setParameters(encodingParameters);
  } catch (e) {
    return {
      error: {
        message: e.message
      }
    };
  }

  return {
    result: serializeLocalParticipant(localParticipant)
  };
}

/**
 * Unpublish a {@link LocalTrack} from a {@link Room}.
 * @param {string} target - {@link LocalParticipant} SID
 * @param {Array<*>} args
 * @returns {object}
 */
export function unpublishTrack(target: string, args: any): any {
  const localParticipants: Map<string, any> = new Map();
  rooms.forEach((room: any) => localParticipants.set(room.localParticipant.sid, room.localParticipant));

  const localParticipant: any = localParticipants.get(target);
  if (!localParticipant) {
    return {
      error: {
        message: 'Participant not found'
      }
    };
  }

  const localTrack: any = localTracks.get(args[0]);
  if (!localTrack) {
    return {
      error: {
        message: 'LocalTrack not found'
      }
    };
  }

  let localTrackPublication: any;
  try {
    localTrackPublication = localParticipant.unpublishTrack(localTrack);
  } catch (e) {
    return {
      error: {
        message: e.message
      }
    };
  }

  return {
    result: serializeLocalTrackPublication(localTrackPublication)
  };
}

/**
 * Unpublish {@link LocalTrack}s from a {@link Room}.
 * @param {string} target - {@link LocalParticipant} SID
 * @param {Array<*>} args
 * @returns {Array<object>}
 */
export function unpublishTracks(target: string, args: any): any {
  const localParticipants: Map<string, any> = new Map();
  rooms.forEach((room: any) => localParticipants.set(room.localParticipant.sid, room.localParticipant));

  const localParticipant: any = localParticipants.get(target);
  if (!localParticipant) {
    return {
      error: {
        message: 'Participant not found'
      }
    };
  }

  const localTracksToUnpublish: any = args[0].map((trackId: string) => localTracks.get(trackId));
  if (localTracksToUnpublish.some((localTrack: any) => !localTrack)) {
    return {
      error: {
        message: 'Some LocalTracks not found'
      }
    };
  }

  let localTrackPublications: any;
  try {
    localTrackPublications = localParticipant.unpublishTracks(localTracksToUnpublish);
  } catch (e) {
    return {
      error: {
        message: e.message
      }
    };
  }

  return {
    result: localTrackPublications.map(serializeLocalTrackPublication)
  };
}
