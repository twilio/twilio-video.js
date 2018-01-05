import {
  serializeLocalTrack,
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
