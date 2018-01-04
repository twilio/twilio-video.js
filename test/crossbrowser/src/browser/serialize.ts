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
    ...serializeParticipant(localParticipant)
  };
}

/**
 * Serialize a {@link Participant}.
 * @param {Participant} participant
 * @returns {object}
 */
export function serializeParticipant(participant: any): any {
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
    audioTracks: Array.from(audioTracks.values()).map(serializeLocalTrack),
    dataTracks: Array.from(dataTracks.values()).map(serializeLocalTrack),
    identity,
    sid,
    state,
    tracks: Array.from(tracks.values()).map(serializeLocalTrack),
    videoTracks: Array.from(videoTracks.values()).map(serializeLocalTrack)
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
    participants: Array.from(participants.values()).map(serializeParticipant),
    sid,
    state
  };
}
