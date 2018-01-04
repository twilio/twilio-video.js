declare const Twilio: any;

const localTracks: Map<string, any> = new Map();
const rooms: Map<number, any> = new Map();

let connectAttempt = 0;

/**
 * Connect to a {@link Room}.
 * @param {Array<*>} args
 * @param {(room: Room) => object} serialize
 * @returns {Promise<object>}
 */
export async function connect(args: any, serialize: (room: any) => any): Promise<any> {
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
  room.localParticipant.tracks.forEach((track: any) => localTracks.set(track.id, track));
  rooms.set(connectAttempt, room);
  return {
    result: {
      _instanceId: connectAttempt++,
      ...serialize(room)
    }
  };
}

/**
 * Create a {@link LocalTrack}.
 * @param {Array<*>} args
 * @param {(track: LocalTrack) => object} serialize
 * @returns {Promise<object>}
 */
export async function createLocalTrack(args: any, serialize: (track: any) => any): Promise<any> {
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
    result: serialize(localTrack)
  };
}

/**
 * Create an array of {@link LocalTrack}s.
 * @param {Array<*>} args
 * @param {(track: LocalTrack) => object} serialize
 * @returns {Promise<object>}
 */
export async function createLocalTracks(args: any, serialize: (track: any) => any): Promise<any> {
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
    result: localTracksArray.map((track: any) => serialize(track))
  };
}
