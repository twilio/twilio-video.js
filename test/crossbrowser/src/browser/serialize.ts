/**
 * Serialize a {@link LocalDataTrack}.
 * @private
 * @param {@link LocalDataTrack} localDataTrack
 * @returns {object}
 */
function serializeLocalDataTrack(localDataTrack: any): any {
  const {
    maxPacketLifetime,
    maxRetransmits,
    ordered,
    reliable
  } = localDataTrack;

  return {
    maxPacketLifetime,
    maxRetransmits,
    ordered,
    reliable,
    ...serializeTrack(localDataTrack)
  };
}

/**
 * Serialize a {@link LocalMediaTrack}.
 * @private
 * @param {@link LocalMediaTrack} localMediaTrack
 * @returns {object}
 */
function serializeLocalMediaTrack(localMediaTrack: any): any {
  return {
    isStopped: localMediaTrack.isStopped,
    ...serializeMediaTrack(localMediaTrack)
  };
}

/**
 * Serialize a {@link MediaTrack}.
 * @private
 * @param {@link MediaTrack} mediaTrack
 * @returns {object}
 */
function serializeMediaTrack(mediaTrack: any): any {
  return {
    isEnabled: mediaTrack.isEnabled,
    isStarted: mediaTrack.isStarted,
    ...serializeTrack(mediaTrack)
  };
}

/**
 * Serialize a {@link RemoteDataTrack}.
 * @param {RemoteDataTrack} remoteDataTrack
 * @returns {object}
 */
function serializeRemoteDataTrack(remoteDataTrack: any): any {
  const {
    isSubscribed,
    maxPacketLifetime,
    maxRetransmits,
    ordered,
    reliable,
    sid
  } = remoteDataTrack;

  return {
    isSubscribed,
    maxPacketLifetime,
    maxRetransmits,
    ordered,
    reliable,
    sid,
    ...serializeTrack(remoteDataTrack)
  };
}

/**
 * Serialize a {@link RemoteMediaTrack}.
 * @param {RemoteMediaTrack} remoteMediaTrack
 * @returns {object}
 */
function serializeRemoteMediaTrack(remoteMediaTrack: any): any {
  return {
    isSubscribed: remoteMediaTrack.isSubscribed,
    sid: remoteMediaTrack.sid,
    ...serializeMediaTrack(remoteMediaTrack)
  };
}

/**
 * Serialize a {@link Track}.
 * @private
 * @param {@link Track} track
 * @returns {object}
 */
function serializeTrack(track: any): any {
  return {
    id: track.id,
    kind: track.kind,
    name: track.name
  };
}

/**
 * Serialize a {@link LocalTrack}.
 * @param {LocalTrack} localTrack
 * @returns {object}
 */
export function serializeLocalTrack(localTrack: any): any {
  return {
    audio: serializeLocalMediaTrack,
    data: serializeLocalDataTrack,
    video: serializeLocalMediaTrack
  }[localTrack.kind](localTrack);
}

/**
 * Serialize a {@link RemoteTrack}.
 * @param {RemoteTrack} remoteTrack
 * @returns {object}
 */
export function serializeRemoteTrack(remoteTrack: any): any {
  return {
    audio: serializeRemoteMediaTrack,
    data: serializeRemoteDataTrack,
    video: serializeRemoteMediaTrack
  }[remoteTrack.kind](remoteTrack);
}

/**
 * Serialize a {@link LocalTrackPublication}.
 * @param {LocalTrackPublication} localTrackPublication
 * @returns {object}
 */
export function serializeLocalTrackPublication(localTrackPublication: any): any {
  const {
    kind,
    track,
    trackName,
    trackSid
  } = localTrackPublication;

  return {
    kind,
    track: serializeLocalTrack(track),
    trackName,
    trackSid
  };
}

/**
 * Serialize a {@link LocalParticipant}.
 * @param {LocalParticipant} localParticipant
 * @returns {object}
 */
export function serializeLocalParticipant(localParticipant: any): any {
  const {
    audioTrackPublications,
    dataTrackPublications,
    trackPublications,
    videoTrackPublications
  } = localParticipant;

  return {
    audioTrackPublications: Array.from(audioTrackPublications.values()).map(serializeLocalTrackPublication),
    dataTrackPublications: Array.from(dataTrackPublications.values()).map(serializeLocalTrackPublication),
    trackPublications: Array.from(trackPublications.values()).map(serializeLocalTrackPublication),
    videoTrackPublications: Array.from(videoTrackPublications.values()).map(serializeLocalTrackPublication),
    ...serializeParticipant(localParticipant, serializeLocalTrack)
  };
}

/**
 * Serialize a {@link Participant}.
 * @param {Participant} participant
 * @param {(track: any) => any} [serializeTrack=serializeRemoteTrack]
 * @returns {object}
 */
export function serializeParticipant(participant: any, serializeTrack = serializeRemoteTrack): any {
  const {
    audioTracks,
    dataTracks,
    identity,
    sid,
    state,
    tracks,
    videoTracks
  } = participant;

  return {
    audioTracks: Array.from(audioTracks.values()).map(serializeTrack),
    dataTracks: Array.from(dataTracks.values()).map(serializeTrack),
    identity,
    sid,
    state,
    tracks: Array.from(tracks.values()).map(serializeTrack),
    videoTracks: Array.from(videoTracks.values()).map(serializeTrack)
  };
}

/**
 * Serialize a {@link Room}.
 * @param {Room} room
 * @returns {object}
 */
export function serializeRoom(room: any): any {
  const {
    isRecording,
    localParticipant,
    name,
    participants,
    sid,
    state
  } = room;

  return {
    isRecording,
    localParticipant: serializeLocalParticipant(localParticipant),
    name,
    participants: Array.from(participants.values()).map((participant: any) => serializeParticipant(participant)),
    sid,
    state
  };
}
