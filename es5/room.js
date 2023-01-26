'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var EventEmitter = require('./eventemitter');
var RemoteParticipant = require('./remoteparticipant');
var StatsReport = require('./stats/statsreport');
var _a = require('./util'), flatMap = _a.flatMap, valueToJSON = _a.valueToJSON;
var nInstances = 0;
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
var Room = /** @class */ (function (_super) {
    __extends(Room, _super);
    /**
     * Construct a {@link Room}.
     * @param {RoomSignaling} signaling
     * @param {?object} [options={}]
     */
    function Room(localParticipant, signaling, options) {
        var _this = _super.call(this) || this;
        var log = options.log.createLog('default', _this);
        var participants = new Map();
        /* istanbul ignore next */
        Object.defineProperties(_this, {
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
                get: function () {
                    return this.participants.get(signaling.dominantSpeakerSid) || null;
                }
            },
            isRecording: {
                enumerable: true,
                get: function () {
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
                get: function () {
                    return signaling.state;
                }
            },
            mediaRegion: {
                enumerable: true,
                value: signaling.mediaRegion
            }
        });
        handleLocalParticipantEvents(_this, localParticipant);
        handleRecordingEvents(_this, signaling.recording);
        handleSignalingEvents(_this, signaling);
        verifyNoiseCancellation(_this);
        log.info('Created a new Room:', _this.name);
        log.debug('Initial RemoteParticipants:', Array.from(_this._participants.values()));
        return _this;
    }
    Room.prototype.toString = function () {
        return "[Room #" + this._instanceId + ": " + this.sid + "]";
    };
    /**
     * Disconnect from the {@link Room}.
     * @returns {this}
     */
    Room.prototype.disconnect = function () {
        this._log.info('Disconnecting');
        this._signaling.disconnect();
        return this;
    };
    /**
     * Get the {@link Room}'s media statistics. This is not supported in Safari 12.0 or below
     * due to this bug : https://bugs.webkit.org/show_bug.cgi?id=192601
     *
     * @returns {Promise.<Array<StatsReport>>}
     */
    Room.prototype.getStats = function () {
        var _this = this;
        return this._signaling.getStats().then(function (responses) {
            return Array.from(responses).map(function (_a) {
                var _b = __read(_a, 2), id = _b[0], response = _b[1];
                return new StatsReport(id, Object.assign({}, response, {
                    localAudioTrackStats: rewriteLocalTrackIds(_this, response.localAudioTrackStats),
                    localVideoTrackStats: rewriteLocalTrackIds(_this, response.localVideoTrackStats)
                }));
            });
        });
    };
    /**
     * Restart the muted local media {@link Track}s and play inadvertently paused HTMLMediaElements
     * that are attached to local and remote media {@link Track}s. This method is useful mainly on
     * mobile browsers (Safari and Chrome on iOS), where there is a possibility that the muted local
     * media {@link Track}s are never unmuted and inadvertently paused HTMLMediaElements are never
     * played again, especially after handling an incoming phone call.
     * @returns {this}
     */
    Room.prototype.refreshInactiveMedia = function () {
        var localTrackPublications = this.localParticipant.tracks;
        var localMediaTracks = Array.from(localTrackPublications.values())
            .filter(function (_a) {
            var kind = _a.track.kind;
            return kind !== 'data';
        })
            .map(function (_a) {
            var track = _a.track;
            return track;
        });
        var remoteMediaTracks = flatMap(this.participants, function (participants) { return Array.from(participants.tracks.values()); })
            .filter(function (_a) {
            var track = _a.track;
            return track && track.kind !== 'data';
        })
            .map(function (_a) {
            var track = _a.track;
            return track;
        });
        var mediaTracks = localMediaTracks.concat(remoteMediaTracks);
        var unmuteEvent = new Event('unmute');
        localMediaTracks.forEach(function (_a) {
            var isMuted = _a.isMuted, mediaStreamTrack = _a.mediaStreamTrack;
            if (isMuted) {
                mediaStreamTrack.dispatchEvent(unmuteEvent);
            }
        });
        var pauseEvent = new Event('pause');
        mediaTracks.forEach(function (_a) {
            var attachments = _a._attachments, elShims = _a._elShims;
            return attachments.forEach(function (el) {
                var shim = elShims.get(el);
                var isInadvertentlyPaused = el.paused && shim && !shim.pausedIntentionally();
                if (isInadvertentlyPaused) {
                    el.dispatchEvent(pauseEvent);
                }
            });
        });
        return this;
    };
    Room.prototype.toJSON = function () {
        return valueToJSON(this);
    };
    return Room;
}(EventEmitter));
function verifyNoiseCancellation(room) {
    var allowedAudioProcessors = room.localParticipant._signaling.audioProcessors;
    room.localParticipant.audioTracks.forEach(function (_a) {
        var track = _a.track;
        var noiseCancellation = track.noiseCancellation;
        if (noiseCancellation && !allowedAudioProcessors.includes(noiseCancellation.vendor)) {
            room._log.warn(noiseCancellation.vendor + " is not supported in this room. disabling it permanently");
            noiseCancellation.disablePermanently();
        }
    });
}
function rewriteLocalTrackIds(room, trackStats) {
    var localParticipantSignaling = room.localParticipant._signaling;
    return trackStats.reduce(function (trackStats, trackStat) {
        var publication = localParticipantSignaling.tracks.get(trackStat.trackId);
        var trackSender = localParticipantSignaling.getSender(publication);
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
    var log = room._log, clientTrackSwitchOffControl = room._clientTrackSwitchOffControl, contentPreferencesMode = room._contentPreferencesMode;
    var participant = new RemoteParticipant(participantSignaling, { log: log, clientTrackSwitchOffControl: clientTrackSwitchOffControl, contentPreferencesMode: contentPreferencesMode });
    log.info('A new RemoteParticipant connected:', participant);
    room._participants.set(participant.sid, participant);
    room.emit('participantConnected', participant);
    // Reemit Track and RemoteParticipant events.
    var eventListeners = [
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
    ].map(function (eventOrPair) {
        var _a = __read(Array.isArray(eventOrPair)
            ? eventOrPair
            : [eventOrPair, eventOrPair], 2), event = _a[0], participantEvent = _a[1];
        function reemit() {
            var args = [].slice.call(arguments);
            args.unshift(participantEvent);
            args.push(participant);
            room.emit.apply(room, __spreadArray([], __read(args)));
        }
        participant.on(event, reemit);
        return [event, reemit];
    });
    participant.once('disconnected', function participantDisconnected() {
        var dominantSpeaker = room.dominantSpeaker;
        log.info('RemoteParticipant disconnected:', participant);
        room._participants.delete(participant.sid);
        eventListeners.forEach(function (args) {
            participant.removeListener(args[0], args[1]);
        });
        room.emit('participantDisconnected', participant);
        if (participant === dominantSpeaker) {
            room.emit('dominantSpeakerChanged', room.dominantSpeaker);
        }
    });
}
function handleLocalParticipantEvents(room, localParticipant) {
    var events = ['trackWarning', 'trackWarningsCleared'].map(function (event) { return ({
        eventName: event,
        handler: function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return room.emit.apply(room, __spreadArray([event], __read(__spreadArray(__spreadArray([], __read(args)), [localParticipant]))));
        },
    }); });
    events.forEach(function (_a) {
        var eventName = _a.eventName, handler = _a.handler;
        return localParticipant.on(eventName, handler);
    });
    room.once('disconnected', function () {
        return events.forEach(function (_a) {
            var eventName = _a.eventName, handler = _a.handler;
            return localParticipant.removeListener(eventName, handler);
        });
    });
}
function handleRecordingEvents(room, recording) {
    recording.on('updated', function updated() {
        var started = recording.isEnabled;
        room._log.info("Recording " + (started ? 'started' : 'stopped'));
        room.emit("recording" + (started ? 'Started' : 'Stopped'));
    });
}
function handleSignalingEvents(room, signaling) {
    var log = room._log;
    // Reemit RemoteParticipant events from the RoomSignaling.
    log.debug('Creating a new RemoteParticipant for each ParticipantSignaling '
        + 'in the RoomSignaling');
    signaling.participants.forEach(connectParticipant.bind(null, room));
    log.debug('Setting up RemoteParticipant creation for all subsequent '
        + 'ParticipantSignalings that connect to the RoomSignaling');
    signaling.on('participantConnected', connectParticipant.bind(null, room));
    signaling.on('dominantSpeakerChanged', function () { return room.emit('dominantSpeakerChanged', room.dominantSpeaker); });
    // Reemit state transition events from the RoomSignaling.
    signaling.on('stateChanged', function stateChanged(state, error) {
        log.info('Transitioned to state:', state);
        switch (state) {
            case 'disconnected':
                room.participants.forEach(function (participant) {
                    participant._unsubscribeTracks();
                });
                room.emit(state, room, error);
                room.localParticipant.tracks.forEach(function (publication) {
                    publication.unpublish();
                });
                signaling.removeListener('stateChanged', stateChanged);
                break;
            case 'reconnecting':
                // NOTE(mpatwardhan): `stateChanged` can get emitted with StateMachine locked.
                // Do not signal  public events synchronously with lock held.
                setTimeout(function () { return room.emit('reconnecting', error); }, 0);
                break;
            default:
                // NOTE(mpatwardhan): `stateChanged` can get emitted with StateMachine locked.
                // Do not signal  public events synchronously with lock held.
                setTimeout(function () { return room.emit('reconnected'); }, 0);
        }
    });
}
module.exports = Room;
//# sourceMappingURL=room.js.map