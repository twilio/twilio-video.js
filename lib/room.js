'use strict';

const EventEmitter = require('./eventemitter');
const RemoteParticipant = require('./remoteparticipant');
const StatsReport = require('./stats/statsreport');
const { flatMap, valueToJSON } = require('./util');

let nInstances = 0;

/**
 * A {@link Room} represents communication between you and one or more
 * {@link RemoteParticipant}s sharing {@link AudioTrack}s and
 * {@link VideoTrack}s.
 * <br><br>
 * You can connect to a {@link Room} by calling {@link module:twilio-video.connect}.
 * @extends EventEmitter
 * @property {?RemoteParticipant} dominantSpeaker - The Dominant Speaker in the
 *   {@link Room}, if any
 * @property {boolean} isRecording - Whether or not the {@link Room} is being
 *   recorded
 * @property {LocalParticipant} localParticipant - Your {@link LocalParticipant}
 *   in the {@link Room}
 * @property {string} mediaRegion - String indicating geographical region
 *    where  media is processed for the {@link Room}.
 * @property {string} name - The {@link Room}'s name
 * @property {Map<Participant.SID, RemoteParticipant>} participants -
 *   The {@link RemoteParticipant}s participating in this {@link Room}
 * @property {Room.SID} sid - The {@link Room}'s SID
 * @property {string} state - "connected", "reconnecting", or "disconnected"
 * @throws {SignalingConnectionDisconnectedError}
 * @emits Room#disconnected
 * @emits Room#transcription
 * @emits Room#participantConnected
 * @emits Room#participantDisconnected
 * @emits Room#participantReconnected
 * @emits Room#participantReconnecting
 * @emits Room#reconnected
 * @emits Room#reconnecting
 * @emits Room#recordingStarted
 * @emits Room#recordingStopped
 * @emits Room#trackDimensionsChanged
 * @emits Room#trackDisabled
 * @emits Room#trackEnabled
 * @emits Room#trackMessage
 * @emits Room#trackPublished
 * @emits Room#trackPublishPriorityChanged
 * @emits Room#trackStarted
 * @emits Room#trackSubscribed
 * @emits Room#trackSwitchedOff
 * @emits Room#trackSwitchedOn
 * @emits Room#trackUnpublished
 * @emits Room#trackUnsubscribed
 * @emits Room#trackWarning
 * @emits Room#trackWarningsCleared
 */
class Room extends EventEmitter {
  /**
   * Construct a {@link Room}.
   * @param {RoomSignaling} signaling
   * @param {?object} [options={}]
   */
  constructor(localParticipant, signaling, options) {
    super();

    const log = options.log.createLog('default', this);
    const participants = new Map();

    /* istanbul ignore next */
    Object.defineProperties(this, {
      _log: {
        value: log
      },
      _clientTrackSwitchOffControl: {
        value: options.clientTrackSwitchOffControl || 'disabled'
      },
      _contentPreferencesMode: {
        value: options.contentPreferencesMode || 'disabled'
      },
      _instanceId: {
        value: ++nInstances
      },
      _options: {
        value: options
      },
      _participants: {
        value: participants
      },
      _signaling: {
        value: signaling
      },
      dominantSpeaker: {
        enumerable: true,
        get() {
          return this.participants.get(signaling.dominantSpeakerSid) || null;
        }
      },
      isRecording: {
        enumerable: true,
        get() {
          return signaling.recording.isEnabled || false;
        }
      },
      localParticipant: {
        enumerable: true,
        value: localParticipant
      },
      name: {
        enumerable: true,
        value: signaling.name
      },
      participants: {
        enumerable: true,
        value: participants
      },
      sid: {
        enumerable: true,
        value: signaling.sid
      },
      state: {
        enumerable: true,
        get() {
          return signaling.state;
        }
      },
      mediaRegion: {
        enumerable: true,
        value: signaling.mediaRegion
      }
    });

    handleLocalParticipantEvents(this, localParticipant);
    handleRecordingEvents(this, signaling.recording);
    handleSignalingEvents(this, signaling);
    verifyNoiseCancellation(this);

    log.info('Created a new Room:', this.name);
    log.debug('Initial RemoteParticipants:', Array.from(this._participants.values()));
  }

  toString() {
    return `[Room #${this._instanceId}: ${this.sid}]`;
  }


  /**
   * Disconnect from the {@link Room}.
   * @returns {this}
   */
  disconnect() {
    this._log.info('Disconnecting');
    this._signaling.disconnect();
    return this;
  }

  /**
   * Get the {@link Room}'s media statistics. This is not supported in Safari 12.0 or below
   * due to this bug : https://bugs.webkit.org/show_bug.cgi?id=192601
   *
   * @returns {Promise.<Array<StatsReport>>}
   */
  getStats() {
    return this._signaling.getStats().then(responses =>
      Array.from(responses).map(([id, response]) =>
        new StatsReport(id, Object.assign({}, response, {
          localAudioTrackStats: rewriteLocalTrackIds(this, response.localAudioTrackStats),
          localVideoTrackStats: rewriteLocalTrackIds(this, response.localVideoTrackStats)
        }))
      )
    );
  }

  /**
   * Restart the muted local media {@link Track}s and play inadvertently paused HTMLMediaElements
   * that are attached to local and remote media {@link Track}s. This method is useful mainly on
   * mobile browsers (Safari and Chrome on iOS), where there is a possibility that the muted local
   * media {@link Track}s are never unmuted and inadvertently paused HTMLMediaElements are never
   * played again, especially after handling an incoming phone call.
   * @returns {this}
   */
  refreshInactiveMedia() {
    const { tracks: localTrackPublications } = this.localParticipant;

    const localMediaTracks = Array.from(localTrackPublications.values())
      .filter(({ track: { kind } }) => kind !== 'data')
      .map(({ track }) => track);

    const remoteMediaTracks = flatMap(this.participants, participants => Array.from(participants.tracks.values()))
      .filter(({ track }) => track && track.kind !== 'data')
      .map(({ track }) => track);

    const mediaTracks = localMediaTracks.concat(remoteMediaTracks);

    const unmuteEvent = new Event('unmute');
    localMediaTracks.forEach(({ isMuted, mediaStreamTrack }) => {
      if (isMuted) {
        mediaStreamTrack.dispatchEvent(unmuteEvent);
      }
    });

    const pauseEvent = new Event('pause');
    mediaTracks.forEach(({ _attachments: attachments, _elShims: elShims }) => attachments.forEach(el => {
      const shim = elShims.get(el);
      const isInadvertentlyPaused = el.paused && shim && !shim.pausedIntentionally();
      if (isInadvertentlyPaused) {
        el.dispatchEvent(pauseEvent);
      }
    }));

    return this;
  }

  toJSON() {
    return valueToJSON(this);
  }
}

function verifyNoiseCancellation(room) {
  const allowedAudioProcessors = room.localParticipant._signaling.audioProcessors;
  room.localParticipant.audioTracks.forEach(({ track }) => {
    const noiseCancellation = track.noiseCancellation;
    if (noiseCancellation && !allowedAudioProcessors.includes(noiseCancellation.vendor)) {
      room._log.warn(`${noiseCancellation.vendor} is not supported in this room. disabling it permanently`);
      noiseCancellation.disablePermanently();
    }
  });
}

function rewriteLocalTrackIds(room, trackStats) {
  const localParticipantSignaling = room.localParticipant._signaling;
  return trackStats.reduce((trackStats, trackStat) => {
    const publication = localParticipantSignaling.tracks.get(trackStat.trackId);
    const trackSender = localParticipantSignaling.getSender(publication);
    return trackSender
      ? [Object.assign({}, trackStat, { trackId: trackSender.id })].concat(trackStats)
      : trackStats;
  }, []);
}

/**
 * A {@link Room.SID} is a 34-character string starting with "RM"
 * that uniquely identifies a {@link Room}.
 * @type string
 * @typedef Room.SID
 */

/**
 * The Dominant Speaker in the {@link Room} changed. Either the Dominant Speaker
 * is a new {@link RemoteParticipant} or the Dominant Speaker has been reset and
 * is now null.
 * @param {?RemoteParticipant} dominantSpeaker - The Dominant Speaker in the
 *   {@link Room}, if any
 * @event Room#dominantSpeakerChanged
 */

/**
 * Your {@link LocalParticipant} was disconnected from the {@link Room} and all
 * other {@link RemoteParticipant}s.
 * @param {Room} room - The {@link Room} your
 *   {@link LocalParticipant} was disconnected from
 * @param {?TwilioError} error - Present when the {@link LocalParticipant} got
 *   disconnected from the {@link Room} unexpectedly
 * @event Room#disconnected
 * @example
 * myRoom.on('disconnected', function(room, error) {
 *   if (error) {
 *     console.log('Unexpectedly disconnected:', error);
 *   }
 *   myRoom.localParticipant.tracks.forEach(function(track) {
 *     track.stop();
 *     track.detach();
 *   });
 * });
 */

/**
 * Emitted when transcription data is received.
 * This event is only emitted when the {@link Room} is configured for transcription.
 * @param {TranscriptionEvent} transcriptionEvent - The transcription event data.
 * @param {string} transcriptionEvent.language_code - The BCP-47 language code (e.g., 'en-US') of the transcribed text.
 * @param {boolean} transcriptionEvent.partial_results - Whether the transcription is a final or a partial result.
 * @param {string} transcriptionEvent.participant - The SID of the speaking participant.
 * @param {number} transcriptionEvent.sequence_number - Starts with one and increments monotonically.
 * @param {string} transcriptionEvent.timestamp - ISO 8601 timestamp of when the transcription was generated.
 * @param {string} transcriptionEvent.track - The SID of the audio track being transcribed.
 * @param {string} transcriptionEvent.transcription - The transcribed text.
 * @param {string} transcriptionEvent.type - Constant 'extension_transcriptions'.
 * @event Room#transcription
 * @example
 * room.on('transcription', transcriptionEvent => {
 *   console.log(`${transcriptionEvent.participant}: ${transcriptionEvent.transcription}`);
 * });
 */

/**
 * A {@link RemoteParticipant} joined the {@link Room}. In Large Group Rooms (Maximum
 * Participants greater than 50), this event is raised only when a {@link RemoteParticipant}
 * publishes at least one {@link LocalTrack}.
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who joined
 * @event Room#participantConnected
 * @example
 * myRoom.on('participantConnected', function(participant) {
 *   console.log(participant.identity + ' joined the Room');
 * });
 */

/**
 * A {@link RemoteParticipant} left the {@link Room}. In Large Group Rooms (Maximum
 * Participants greater than 50), this event is raised only when a {@link RemoteParticipant}
 * unpublishes all its {@link LocalTrack}s.
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who left
 * @event Room#participantDisconnected
 * @example
 * myRoom.on('participantDisconnected', function(participant) {
 *   console.log(participant.identity + ' left the Room');
 *   participant.tracks.forEach(function(track) {
 *     track.detach().forEach(function(mediaElement) {
 *       mediaElement.remove();
 *     });
 *   });
 * });
 */

/**
 * A {@link RemoteParticipant} has reconnected to the {@link Room} after a signaling connection disruption.
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} that has reconnected.
 * @event Room#participantReconnected
 * @example
 * myRoom.on('participantReconnected', participant => {
 *   console.log(participant.identity + ' reconnected to the Room');
 * });
 */

/**
 * A {@link RemoteParticipant} is reconnecting to the {@link Room} after a signaling connection disruption.
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} that is reconnecting.
 * @event Room#participantReconnecting
 * @example
 * myRoom.on('participantReconnecting', participant => {
 *   console.log(participant.identity + ' is reconnecting to the Room');
 * });
 */

/**
 * Your application successfully reconnected to the {@link Room}. When this
 * event is emitted, the {@link Room} is in state "connected".
 * @event Room#reconnected
 * @example
 * myRoom.on('reconnected', () => {
 *   console.log('Reconnected!');
 * });
 */

/**
 * Your application is reconnecting to the {@link Room}. This happens when there
 * is a disruption in your signaling connection and/or your media connection. When
 * this event is emitted, the {@link Room} is in state "reconnecting". If reconnecting
 * succeeds, the {@link Room} will emit a "reconnected" event.
 * @param {MediaConnectionError|SignalingConnectionDisconnectedError} error - A
 *   {@link MediaConnectionError} if your application is reconnecting due to a
 *   disruption in your media connection, or a {@link SignalingConnectionDisconnectedError}
 *   if your application is reconnecting due to a disruption in your signaling connection
 * @event Room#reconnecting
 * @example
 * myRoom.on('reconnecting', error => {
 *   if (error.code === 53001) {
 *     console.log('Reconnecting your signaling connection!', error.message);
 *   } else if (error.code === 53405) {
 *     console.log('Reconnecting your media connection!', error.message);
 *   }
 * });
 */

/**
 * The {@link Room} is now being recorded
 * @event Room#recordingStarted
 */

/**
 * The {@link Room} is no longer being recorded
 * @event Room#recordingStopped
 */

/**
 * One of the {@link RemoteParticipant}'s {@link VideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose dimensions changed
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteVideoTrack}'s dimensions changed
 * @event Room#trackDimensionsChanged
 */

/**
 * A {@link RemoteTrack} was disabled by a {@link RemoteParticipant} in the {@link Room}.
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication} that represents disabled {@link RemoteTrack}
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   disabled the {@link RemoteTrack}
 * @event Room#trackDisabled
 */

/**
 * A {@link RemoteTrack} was enabled by a {@link RemoteParticipant} in the {@link Room}.
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication} that represents enabled {@link RemoteTrack}
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   enabled the {@link RemoteTrack}
 * @event Room#trackEnabled
 */

/**
 * A message was received over one of the {@link RemoteParticipant}'s
 * {@link RemoteDataTrack}'s.
 * @param {string|ArrayBuffer} data
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} over which the
 *   message was received
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteDataTrack} received the message
 * @event Room#trackMessage
 */

/**
 * A {@link RemoteTrack} was published by a {@link RemoteParticipant} after
 * connecting to the {@link Room}. This event is not emitted for
 * {@link RemoteTrack}s that were published while the {@link RemoteParticipant}
 * was connecting to the {@link Room}.
 * @event Room#trackPublished
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   which represents the published {@link RemoteTrack}
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   published the {@link RemoteTrack}
 * @example
 * function trackPublished(publication, participant) {
 *   console.log(`RemoteParticipant ${participant.sid} published Track ${publication.trackSid}`);
 * }
 *
 * // Handle RemoteTracks published after connecting to the Room.
 * room.on('trackPublished', trackPublished);
 *
 * room.on('participantConnected', participant => {
 *   // Handle RemoteTracks published while connecting to the Room.
 *   participant.trackPublications.forEach(publication => trackPublished(publication, participant));
 * });
 */

/**
 * One of a {@link RemoteParticipant}'s {@link RemoteTrack}s in the {@link Room} started.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that started
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} started
 * @event Room#trackStarted
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was subscribed to.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was subscribed
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was subscribed to
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} was subscribed
 * @event Room#trackSubscribed
 * @example
 * room.on('trackSubscribed', function(track, publication, participant) {
 *   var participantView = document.getElementById('participant-view-' + participant.identity);
 *   participantView.appendChild(track.attach());
 * });
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was switched off.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was switched off
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was subscribed to
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} was switched off
 * @event Room#trackSwitchedOff
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was switched on.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was switched on
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was subscribed to
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} was switched on
 * @event Room#trackSwitchedOn
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} could not be subscribed to.
 * @param {TwilioError} error - The reason the {@link RemoteTrack} could not be
 *   subscribed to
 * @param {RemoteTrackPublication} publication - The
 *   {@link RemoteTrackPublication} for the {@link RemoteTrack} that could not
 *   be subscribed to
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} could not be subscribed to
 * @event Room#trackSubscriptionFailed
 */

/**
 * The {@link RemoteTrack}'s publish {@link Track.Priority} was changed by the
 * {@link RemoteParticipant}.
 * @param {Track.Priority} priority - the {@link RemoteTrack}'s new publish
 *   {@link Track.Priority};
 * @param {RemoteTrackPublication} publication - The
 *   {@link RemoteTrackPublication} for the {@link RemoteTrack} that changed priority
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} changed priority
 * @event Room#trackPublishPriorityChanged
 */

/**
 * A {@link RemoteTrack} was unpublished by a {@link RemoteParticipant} to the {@link Room}.
 * @event Room#trackUnpublished
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   which represents the unpublished {@link RemoteTrack}
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   unpublished the {@link RemoteTrack}
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was unsubscribed from.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was unsubscribed
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was unsubscribed from
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} was unsubscribed
 * @event Room#trackUnsubscribed
 * @example
 * room.on('trackUnsubscribed', function(track, publication, participant) {
 *   track.detach().forEach(function(mediaElement) {
 *     mediaElement.remove();
 *   });
 * });
 */

/**
 * One of the {@link LocalParticipant}'s {@link LocalTrackPublication}s in the {@link Room} encountered a warning.
 * This event is only raised if you enabled warnings using <code>notifyWarnings</code> in <code>ConnectOptions</code>.
 * @param {string} name - The warning that was raised.
 * @param {LocalTrackPublication} publication - The {@link LocalTrackPublication} that encountered the warning.
 * @param {LocalParticipant} participant - The {@link LocalParticipant}
 * @event Room#trackWarning
 * @example
 * room.on('trackWarning', (name, publication, participant) => {
 *   if (name === 'recording-media-lost') {
 *     log(`LocalTrack ${publication.track.name} is not recording media.`,
 *       name, publication, participant);
 *
 *     // Wait a reasonable amount of time to clear the warning.
 *     const timer = setTimeout(() => {
 *       // If the warning is not cleared, you can manually
 *       // reconnect to the room, or show a dialog to the user
 *     }, 5000);
 *
 *     room.once('trackWarningsCleared', (publication, participant) => {
 *       log('LocalTrack warnings have cleared!',
 *         publication, participant);
 *       clearTimeout(timer);
 *     });
 *   }
});
 */

/**
 * One of the {@link LocalParticipant}'s {@link LocalTrackPublication}s in the {@link Room} cleared all warnings.
 * This event is only raised if you enabled warnings using <code>notifyWarnings</code> in <code>ConnectOptions</code>.
 * @param {LocalTrackPublication} publication - The {@link LocalTrackPublication} that cleared all warnings.
 * @param {LocalParticipant} participant - The {@link LocalParticipant}
 * @event Room#trackWarningsCleared
 */

function connectParticipant(room, participantSignaling) {
  const { _log: log, _clientTrackSwitchOffControl: clientTrackSwitchOffControl, _contentPreferencesMode: contentPreferencesMode, _options: { MediaStream, mapMediaElement, disposeMediaElement } } = room;
  const participant = new RemoteParticipant(participantSignaling, { log, clientTrackSwitchOffControl, contentPreferencesMode, MediaStream, mapMediaElement, disposeMediaElement });

  log.info('A new RemoteParticipant connected:', participant);
  room._participants.set(participant.sid, participant);
  room.emit('participantConnected', participant);

  // Reemit Track and RemoteParticipant events.
  const eventListeners = [
    ['reconnected', 'participantReconnected'],
    ['reconnecting', 'participantReconnecting'],
    'trackDimensionsChanged',
    'trackDisabled',
    'trackEnabled',
    'trackMessage',
    'trackPublished',
    'trackPublishPriorityChanged',
    'trackStarted',
    'trackSubscribed',
    'trackSubscriptionFailed',
    'trackSwitchedOff',
    'trackSwitchedOn',
    'trackUnpublished',
    'trackUnsubscribed'
  ].map(eventOrPair => {
    const [event, participantEvent] = Array.isArray(eventOrPair)
      ? eventOrPair
      : [eventOrPair, eventOrPair];

    function reemit() {
      const args = [].slice.call(arguments);
      args.unshift(participantEvent);
      args.push(participant);
      room.emit(...args);
    }
    participant.on(event, reemit);
    return [event, reemit];
  });

  participant.once('disconnected', function participantDisconnected() {
    const dominantSpeaker = room.dominantSpeaker;
    log.info('RemoteParticipant disconnected:', participant);
    room._participants.delete(participant.sid);
    eventListeners.forEach(args => {
      participant.removeListener(args[0], args[1]);
    });
    room.emit('participantDisconnected', participant);
    if (participant === dominantSpeaker) {
      room.emit('dominantSpeakerChanged', room.dominantSpeaker);
    }
  });
}

function handleLocalParticipantEvents(room, localParticipant) {
  const events = ['trackWarning', 'trackWarningsCleared'].map(event => ({
    eventName: event,
    handler: (...args) => room.emit(event, ...[...args, localParticipant]),
  }));

  events.forEach(({ eventName, handler }) =>
    localParticipant.on(eventName, handler));

  room.once('disconnected', () =>
    events.forEach(({ eventName, handler }) =>
      localParticipant.removeListener(eventName, handler)));
}

function handleRecordingEvents(room, recording) {
  recording.on('updated', function updated() {
    const started = recording.isEnabled;
    room._log.info(`Recording ${started ? 'started' : 'stopped'}`);
    room.emit(`recording${started ? 'Started' : 'Stopped'}`);
  });
}

function handleSignalingEvents(room, signaling) {
  const log = room._log;

  // Reemit RemoteParticipant events from the RoomSignaling.
  log.debug('Creating a new RemoteParticipant for each ParticipantSignaling '
    + 'in the RoomSignaling');
  signaling.participants.forEach(connectParticipant.bind(null, room));
  log.debug('Setting up RemoteParticipant creation for all subsequent '
    + 'ParticipantSignalings that connect to the RoomSignaling');
  signaling.on('participantConnected', connectParticipant.bind(null, room));

  signaling.on('dominantSpeakerChanged', () => room.emit('dominantSpeakerChanged', room.dominantSpeaker));

  signaling.on('transcription', data => room.emit('transcription', data));

  // Reemit state transition events from the RoomSignaling.
  signaling.on('stateChanged', function stateChanged(state, error) {
    log.info('Transitioned to state:', state);
    switch (state) {
      case 'disconnected':
        room.participants.forEach(participant => {
          participant._unsubscribeTracks();
        });
        room.emit(state, room, error);
        room.localParticipant.tracks.forEach(publication => {
          publication.unpublish();
        });
        signaling.removeListener('stateChanged', stateChanged);
        break;
      case 'reconnecting':

        // NOTE(mpatwardhan): `stateChanged` can get emitted with StateMachine locked.
        // Do not signal  public events synchronously with lock held.
        setTimeout(() => room.emit('reconnecting', error), 0);

        break;
      default:

        // NOTE(mpatwardhan): `stateChanged` can get emitted with StateMachine locked.
        // Do not signal  public events synchronously with lock held.
        setTimeout(() => room.emit('reconnected'), 0);
    }
  });
}

module.exports = Room;
