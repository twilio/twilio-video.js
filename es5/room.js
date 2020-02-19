'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('./eventemitter');
var RemoteParticipant = require('./remoteparticipant');
var StatsReport = require('./stats/statsreport');

var _require = require('./util'),
    valueToJSON = _require.valueToJSON;

var nInstances = 0;

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
 */

var Room = function (_EventEmitter) {
  _inherits(Room, _EventEmitter);

  /**
   * Construct a {@link Room}.
   * @param {RoomSignaling} signaling
   * @param {?object} [options={}]
   */
  function Room(localParticipant, signaling, options) {
    _classCallCheck(this, Room);

    var _this = _possibleConstructorReturn(this, (Room.__proto__ || Object.getPrototypeOf(Room)).call(this));

    var log = options.log.createLog('default', _this);
    var participants = new Map();

    /* istanbul ignore next */
    Object.defineProperties(_this, {
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
        get: function get() {
          return this.participants.get(signaling.dominantSpeakerSid) || null;
        }
      },
      isRecording: {
        enumerable: true,
        get: function get() {
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
        get: function get() {
          return signaling.state;
        }
      }
    });

    handleRecordingEvents(_this, signaling.recording);
    handleSignalingEvents(_this, signaling);

    log.info('Created a new Room:', _this.name);
    log.debug('Initial RemoteParticipants:', Array.from(_this._participants.values()));
    return _this;
  }

  _createClass(Room, [{
    key: 'toString',
    value: function toString() {
      return '[Room #' + this._instanceId + ': ' + this.sid + ']';
    }

    /**
     * Disconnect from the {@link Room}.
     * @returns {this}
     */

  }, {
    key: 'disconnect',
    value: function disconnect() {
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

  }, {
    key: 'getStats',
    value: function getStats() {
      var _this2 = this;

      return this._signaling.getStats().then(function (responses) {
        return Array.from(responses).map(function (_ref) {
          var _ref2 = _slicedToArray(_ref, 2),
              id = _ref2[0],
              response = _ref2[1];

          return new StatsReport(id, Object.assign({}, response, {
            localAudioTrackStats: rewriteLocalTrackIds(_this2, response.localAudioTrackStats),
            localVideoTrackStats: rewriteLocalTrackIds(_this2, response.localVideoTrackStats)
          }));
        });
      });
    }
  }, {
    key: 'toJSON',
    value: function toJSON() {
      return valueToJSON(this);
    }
  }]);

  return Room;
}(EventEmitter);

function rewriteLocalTrackIds(room, trackStats) {
  var localParticipantSignaling = room.localParticipant._signaling;
  return trackStats.reduce(function (trackStats, trackStat) {
    var publication = localParticipantSignaling.tracks.get(trackStat.trackId);
    var trackSender = localParticipantSignaling.getSender(publication);
    return trackSender ? [Object.assign({}, trackStat, { trackId: trackSender.id })].concat(trackStats) : trackStats;
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
 * myRoom.on('participantReconnected', participant => {
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

function connectParticipant(room, participantSignaling) {
  var log = room._log;
  var participant = new RemoteParticipant(participantSignaling, { log: log });

  log.info('A new RemoteParticipant connected:', participant);
  room._participants.set(participant.sid, participant);
  room.emit('participantConnected', participant);

  // Reemit Track and RemoteParticipant events.
  var eventListeners = [['reconnected', 'participantReconnected'], ['reconnecting', 'participantReconnecting'], 'trackDimensionsChanged', 'trackDisabled', 'trackEnabled', 'trackMessage', 'trackPublished', 'trackPublishPriorityChanged', 'trackStarted', 'trackSubscribed', 'trackSubscriptionFailed', 'trackSwitchedOff', 'trackSwitchedOn', 'trackUnpublished', 'trackUnsubscribed'].map(function (eventOrPair) {
    var _ref3 = Array.isArray(eventOrPair) ? eventOrPair : [eventOrPair, eventOrPair],
        _ref4 = _slicedToArray(_ref3, 2),
        event = _ref4[0],
        participantEvent = _ref4[1];

    function reemit() {
      var args = [].slice.call(arguments);
      args.unshift(participantEvent);
      args.push(participant);
      room.emit.apply(room, _toConsumableArray(args));
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

function handleRecordingEvents(room, recording) {
  recording.on('updated', function updated() {
    var started = recording.isEnabled;
    room._log.info('Recording ' + (started ? 'started' : 'stopped'));
    room.emit('recording' + (started ? 'Started' : 'Stopped'));
  });
}

function handleSignalingEvents(room, signaling) {
  var log = room._log;

  // Reemit RemoteParticipant events from the RoomSignaling.
  log.debug('Creating a new RemoteParticipant for each ParticipantSignaling ' + 'in the RoomSignaling');
  signaling.participants.forEach(connectParticipant.bind(null, room));
  log.debug('Setting up RemoteParticipant creation for all subsequent ' + 'ParticipantSignalings that connect to the RoomSignaling');
  signaling.on('participantConnected', connectParticipant.bind(null, room));

  signaling.on('dominantSpeakerChanged', function () {
    return room.emit('dominantSpeakerChanged', room.dominantSpeaker);
  });

  // Reemit state transition events from the RoomSignaling.
  signaling.on('stateChanged', function stateChanged(state, error) {
    log.info('Transitioned to state:', state);
    switch (state) {
      case 'disconnected':
        room.participants.forEach(function (participant) {
          participant._unsubscribeTracks();
        });
        room.emit(state, room, error);
        signaling.removeListener('stateChanged', stateChanged);
        break;
      case 'reconnecting':
        room.emit('reconnecting', error);
        break;
      default:
        room.emit('reconnected');
    }
  });
}

module.exports = Room;