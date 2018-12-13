'use strict';

const EventEmitter = require('events').EventEmitter;
const RemoteParticipant = require('./remoteparticipant');
const StatsReport = require('./stats/statsreport');
const { deprecateEvents } = require('./util');
const { MediaConnectionError } = require('./util/twilio-video-errors');

let nInstances = 0;

/**
 * A {@link Room} represents communication between you and one or more
 * {@link RemoteParticipant}s sharing {@link AudioTrack}s and
 * {@link VideoTrack}s.
 * <br><br>
 * You can connect to a {@link Room} by calling {@link connect}.
 * @extends EventEmitter
 * @property {?RemoteParticipant} dominantSpeaker - The Dominant Speaker in the
 *   {@link Room}, if any
 * @property {boolean} isRecording - Whether or not the {@link Room} is being
 *   recorded
 * @property {LocalParticipant} localParticipant - Your {@link LocalParticipant}
 *   in the {@link Room}
 * @property {string} name - The {@link Room}'s name
 * @property {Map<Participant.SID, RemoteParticipant>} participants -
 *   The {@link RemoteParticipant}s participating in this {@link Room}
 * @property {Room.SID} sid - The {@link Room}'s SID
 * @property {string} state - "connected", "reconnecting", or "disconnected"
 * @throws {SignalingConnectionDisconnectedError}
 * @emits Room#disconnected
 * @emits Room#participantConnected
 * @emits Room#participantDisconnected
 * @emits Room#reconnected
 * @emits Room#reconnecting
 * @emits Room#recordingStarted
 * @emits Room#recordingStopped
 * @emits Room#trackAdded
 * @emits Room#trackDimensionsChanged
 * @emits Room#trackDisabled
 * @emits Room#trackEnabled
 * @emits Room#trackMessage
 * @emits Room#trackPublished
 * @emits Room#trackRemoved
 * @emits Room#trackStarted
 * @emits Room#trackSubscribed
 * @emits Room#trackUnpublished
 * @emits Room#trackUnsubscribed
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
      }
    });

    deprecateEvents('Room', this, new Map([
      ['trackAdded', 'trackSubscribed'],
      ['trackRemoved', 'trackUnsubscribed']
    ]), log);

    handleRecordingEvents(this, signaling.recording);
    handleSignalingEvents(this, signaling);

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
    return this._signaling.getStats().then(responses => {
      return Array.from(responses).map(([id, response]) => {
        return new StatsReport(id, response);
      });
    });
  }
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
 * A {@link RemoteParticipant} joined the {@link Room}.
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who joined
 * @event Room#participantConnected
 * @example
 * myRoom.on('participantConnected', function(participant) {
 *   console.log(participant.identity + ' joined the Room');
 * });
 */

/**
 * A {@link RemoteParticipant} left the {@link Room}.
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
 * Your application successfully reconnected to the {@link Room}. When this
 * event is emitted, the {@link Room} is in state "connected".
 * @event Room#reconnected
 * @example
 * myRoom.on('reconnected', () => {
 *   console.log('Reconnected!');
 * });
 */

/**
 * Your application is reconnecting to the {@link Room}. Typically this happens
 * when there is a disruption in your media connection. When this event is
 * emitted, the {@link Room} is in state "reconnecting". If reconnecting
 * succeeds, the {@link Room} will emit a "reconnected" event.
 * @param {TwilioError} error - A {@link TwilioError} explaining why your
 *   application is reconnecting
 * @example
 * myRoom.on('reconnecting', error => {
 *   console.warn('Reconnecting!', error);
 * });
 * @event Room#reconnecting
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
 * A {@link RemoteTrack} was added by a {@link RemoteParticipant} in the {@link Room}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was added
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   added the {@link RemoteTrack}
 * @event Room#trackAdded
 * @deprecated Use {@link RemoteParticipant#trackSubscribed} instead
 * @example
 * room.on('trackAdded', function(track, participant) {
 *   var participantView = document.getElementById('participant-view-' + participant.identity);
 *   participantView.appendChild(track.attach());
 * });
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
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was disabled
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   disabled the {@link RemoteTrack}
 * @event Room#trackDisabled
 */

/**
 * A {@link RemoteTrack} was enabled by a {@link RemoteParticipant} in the {@link Room}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was enabled
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   enabled the {@link RemoteTrack}
 * @event Room#trackEnabled
 */

/**
 * A message was received over one of the {@link RemoteParticipant}'s
 * {@link RemoteDataTrack}'s.
 * @param {string|ArrayBuffer} data
 * @param {RemoteVideoTrack} track - The {@link RemoteDataTrack} over which the
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
 * A {@link RemoteTrack} was removed by a {@link RemoteParticipant} in the {@link Room}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was removed
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   removed the {@link RemoteTrack}
 * @event Room#trackRemoved
 * @deprecated Use {@link RemoteParticipant#trackUnsubscribed} instead
 * @example
 * room.on('trackRemoved', function(track, participant) {
 *   track.detach().forEach(function(mediaElement) {
 *     mediaElement.remove();
 *   });
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
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} was subscribed
 * @event Room#trackSubscribed
 * @example
 * room.on('trackSubscribed', function(track, participant) {
 *   var participantView = document.getElementById('participant-view-' + participant.identity);
 *   participantView.appendChild(track.attach());
 * });
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
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} was unsubscribed
 * @event Room#trackUnsubscribed
 * @example
 * room.on('trackUnsubscribed', function(track, participant) {
 *   track.detach().forEach(function(mediaElement) {
 *     mediaElement.remove();
 *   });
 * });
 */

function connectParticipant(room, participantSignaling) {
  const log = room._log;
  const participant = new RemoteParticipant(participantSignaling, { log });

  log.info('A new RemoteParticipant connected:', participant);
  room._participants.set(participant.sid, participant);
  room.emit('participantConnected', participant);

  // Reemit Track events from the RemoteParticipant.
  const eventListeners = [
    ['trackSubscribed', 'trackAdded'],
    'trackDimensionsChanged',
    'trackDisabled',
    'trackEnabled',
    'trackMessage',
    'trackPublished',
    ['trackUnsubscribed', 'trackRemoved'],
    'trackStarted',
    'trackSubscribed',
    'trackSubscriptionFailed',
    'trackUnpublished',
    'trackUnsubscribed'
  ].map(eventOrEventPair => {
    const participantEvent = typeof eventOrEventPair === 'string'
      ? eventOrEventPair
      : eventOrEventPair[0];
    const roomEvent = typeof eventOrEventPair === 'string'
      ? eventOrEventPair
      : eventOrEventPair[1];
    function reemit() {
      const args = [].slice.call(arguments);
      args.unshift(roomEvent);
      args.push(participant);
      room.emit(...args);
    }
    participant.on(participantEvent, reemit);
    return [participantEvent, reemit];
  });

  // Reemit state transition events from the RemoteParticipant.
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

  // Reemit state transition events from the RoomSignaling.
  signaling.on('stateChanged', function stateChanged(state, error) {
    log.info('Transitioned to state:', state);
    switch (state) {
      case 'disconnected':
        room.participants.forEach(participant => {
          participant._unsubscribeTracks();
        });
        room.emit(state, room, error);
        signaling.removeListener('stateChanged', stateChanged);
        break;
      case 'reconnecting':
        room.emit('reconnecting', new MediaConnectionError());
        break;
      default:
        room.emit('reconnected');
    }
  });
}

module.exports = Room;
