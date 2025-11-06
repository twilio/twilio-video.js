import {
  ResourceID,
  add,
  lookup,
  remove
} from './resources';

import {
  serializeLocalParticipant,
  serializeLocalTrack,
  serializeLocalTrackPublication,
  serializeRoom
} from './serialize';

declare const Twilio: any;

/**
 * Connect to a {@link Room}.
 * @param {Array<*>} args
 * @param {(room: Room) => void} sendRoomEvents
 * @returns {Promise<object>}
 */
export async function connect(args: any, sendRoomEvents: (room: any) => void): Promise<any> {
  const [token, options] = args;
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
  sendRoomEvents(room);

  return {
    result: serializeRoom(room)
  };
}

/**
 * Create a {@link LocalTrack}.
 * @param {Array<*>} args
 * @returns {Promise<object>}
 */
export async function createLocalTrack(args: any, sendLocalTrackEvents: (track: any) => void): Promise<any> {
  const [kind, options] = args;
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
  sendLocalTrackEvents(localTrack);

  return {
    result: serializeLocalTrack(localTrack)
  };
}

/**
 * Create an array of {@link LocalTrack}s.
 * @param {Array<*>} args
 * @returns {Promise<object>}
 */
export async function createLocalTracks(args: any, sendLocalTrackEvents: (track: any) => void): Promise<any> {
  const [options] = args;
  let localTracks: Array<any>;

  try {
    localTracks = await Twilio.Video.createLocalTracks(options);
  } catch (e) {
    return {
      error: {
        message: e.message
      }
    };
  }
  localTracks.forEach(sendLocalTrackEvents);

  return {
    result: localTracks.map(serializeLocalTrack)
  };
}

/**
 * Disable a {@link LocalMediaTrack}.
 * @param {ResourceID} target
 * @returns {object}
 */
export function disable(target: ResourceID): any {
  const localMediaTrack: any = lookup(target);
  if (!localMediaTrack) {
    return {
      error: {
        message: 'LocalMediaTrack not found'
      }
    };
  }

  localMediaTrack.disable();
  return {
    result: serializeLocalTrack(localMediaTrack)
  };
}

/**
 * Disconnect from a {@link Room}.
 * @param {ResourceID} target - Resource ID of the {@link Room}
 * @returns {object}
 */
export function disconnect(target: ResourceID): any {
  const room: any = lookup(target);
  if (!room) {
    return {
      error: {
        message: 'Room not found'
      }
    };
  }
  room.disconnect();

  return {
    result: serializeRoom(room)
  };
}

/**
 * Enable a {@link LocalMediaTrack}.
 * @param {ResourceID} target
 * @param {Array<*>} args
 * @returns {object}
 */
export function enable(target: ResourceID, args: any): any {
  const localMediaTrack: any = lookup(target);
  if (!localMediaTrack) {
    return {
      error: {
        message: 'LocalMediaTrack not found'
      }
    };
  }

  const enabled: boolean | undefined = args[0];
  localMediaTrack.enable(enabled);

  return {
    result: serializeLocalTrack(localMediaTrack)
  };
}

/**
 * Get {@link Room} stats.
 * @param {ResourceID} target - Resource ID of the {@link Room}.
 * @returns {Promise<object>}
 */
export async function getStats(target: ResourceID): Promise<any> {
  const room: any = lookup(target);
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
      error: {
        message: e.message
      }
    };
  }
}

/**
 * Publish a {@link LocalTrack} to a {@link Room}.
 * @param {ResourceID} target - {@link LocalParticipant} resource ID
 * @param {Array<*>} args
 * @returns {Promise<object>}
 */
export async function publishTrack(target: ResourceID, args: any): Promise<any> {
  const localParticipant: any = lookup(target);
  if (!localParticipant) {
    return {
      error: {
        message: 'LocalParticipant not found'
      }
    };
  }

  const localTrack: any = lookup(args[0]);
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
  add(localTrackPublication);

  return {
    result: serializeLocalTrackPublication(localTrackPublication)
  };
}

/**
 * Publish {@link LocalTrack}s to a {@link Room}.
 * @param {ResourceID} target - {@link LocalParticipant} SID
 * @param {Array<*>} args
 * @returns {Promise<object>}
 */
export async function publishTracks(target: ResourceID, args: any): Promise<any> {
  const localParticipant: any = lookup(target);
  if (!localParticipant) {
    return {
      error: {
        message: 'LocalParticipant not found'
      }
    };
  }

  const localTracksToPublish: any = args[0].map(lookup);
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
  localTrackPublications.forEach(add);

  return {
    result: localTrackPublications.map(serializeLocalTrackPublication)
  };
}

/**
 * Send a message using a {@link LocalDataTrack}.
 * @param {ResourceID} target
 * @param {Array<*>} args
 * @returns {object}
 */
export function send(target: ResourceID, args: any): any {
  const localDataTrack: any = lookup(target);
  if (!localDataTrack) {
    return {
      error: {
        message: 'LocalDataTrack not found'
      }
    };
  }

  const data: string = args[0];
  localDataTrack.send(data);

  return {
    result: serializeLocalTrack(localDataTrack)
  };
}

/**
 * Set the {@link LocalParticipant}'s {@link EncodingParameters}.
 * @param {ResourceID} target - {@link LocalParticipant} SID
 * @param {Array<*>} args
 * @returns {object}
 */
export function setParameters(target: ResourceID, args: any): any {
  const localParticipant: any = lookup(target);
  if (!localParticipant) {
    return {
      error: {
        message: 'LocalParticipant not found'
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
 * Stop a {@link LocalMediaTrack}.
 * @param {ResourceID} target
 * @returns {object}
 */
export function stop(target: ResourceID): any {
  const localMediaTrack: any = lookup(target);
  if (!localMediaTrack) {
    return {
      error: {
        message: 'LocalMediaTrack not found'
      }
    };
  }

  localMediaTrack.stop();
  return {
    result: serializeLocalTrack(localMediaTrack)
  };
}

export function unpublish(target: ResourceID): any {
  const localTrackPublication: any = lookup(target);
  if (!localTrackPublication) {
    return {
      error: {
        message: 'LocalTrackPublication not found'
      }
    };
  }

  localTrackPublication.unpublish();
  remove(localTrackPublication);

  return {
    result: serializeLocalTrackPublication(localTrackPublication)
  };
}


/**
 * Unpublish a {@link LocalTrack} from a {@link Room}.
 * @param {ResourceID} target - {@link LocalParticipant} SID
 * @param {Array<*>} args
 * @returns {object}
 */
export function unpublishTrack(target: ResourceID, args: any): any {
  const localParticipant: any = lookup(target);
  if (!localParticipant) {
    return {
      error: {
        message: 'LocalParticipant not found'
      }
    };
  }

  const localTrack: any = lookup(args[0]);
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
  const serializedPublication = serializeLocalTrackPublication(localTrackPublication);
  remove(localTrackPublication);

  return {
    result: serializedPublication
  };
}

/**
 * Unpublish {@link LocalTrack}s from a {@link Room}.
 * @param {ResourceID} target - {@link LocalParticipant} SID
 * @param {Array<*>} args
 * @returns {Array<object>}
 */
export function unpublishTracks(target: ResourceID, args: any): any {
  const localParticipant: any = lookup(target);
  if (!localParticipant) {
    return {
      error: {
        message: 'LocalParticipant not found'
      }
    };
  }

  const localTracksToUnpublish: any = args[0].map(lookup);
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
  const serializedPublications = localTrackPublications.map(serializeLocalTrackPublication);
  localTrackPublications.forEach(remove);

  return {
    result: serializedPublications
  };
}
