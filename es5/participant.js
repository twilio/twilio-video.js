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
var RemoteAudioTrack = require('./media/track/remoteaudiotrack');
var RemoteAudioTrackPublication = require('./media/track/remoteaudiotrackpublication');
var RemoteDataTrack = require('./media/track/remotedatatrack');
var RemoteDataTrackPublication = require('./media/track/remotedatatrackpublication');
var RemoteVideoTrack = require('./media/track/remotevideotrack');
var RemoteVideoTrackPublication = require('./media/track/remotevideotrackpublication');
var util = require('./util');
var nInstances = 0;
/**
 * {@link NetworkQualityLevel} is a value from 0–5, inclusive, representing the
 * quality of a network connection.
 * @typedef {number} NetworkQualityLevel
 */
/**
 * @extends EventEmitter
 * @property {Map<Track.SID, AudioTrackPublication>} audioTracks -
 *    The {@link Participant}'s {@link AudioTrackPublication}s
 * @property {Map<Track.SID, DataTrackPublication>} dataTracks -
 *    The {@link Participant}'s {@link DataTrackPublication}s.
 * @property {Participant.Identity} identity - The identity of the {@link Participant}
 * @property {?NetworkQualityLevel} networkQualityLevel - The
 *    {@link Participant}'s current {@link NetworkQualityLevel}, if any
 * @property {?NetworkQualityStats} networkQualityStats - The
 *    {@link Participant}'s current {@link NetworkQualityStats}, if any
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @property {string} state - "connected", "disconnected" or "reconnecting"
 * @property {Map<Track.SID, TrackPublication>} tracks -
 *    The {@link Participant}'s {@link TrackPublication}s
 * @property {Map<Track.SID, VideoTrackPublication>} videoTracks -
 *    The {@link Participant}'s {@link VideoTrackPublication}s
 * @emits Participant#disconnected
 * @emits Participant#networkQualityLevelChanged
 * @emits Participant#reconnected
 * @emits Participant#reconnecting
 * @emits Participant#trackDimensionsChanged
 * @emits Participant#trackStarted
 */
var Participant = /** @class */ (function (_super) {
    __extends(Participant, _super);
    /**
     * Construct a {@link Participant}.
     * @param {ParticipantSignaling} signaling
     * @param {object} [options]
     */
    function Participant(signaling, options) {
        var _this = _super.call(this) || this;
        options = Object.assign({
            RemoteAudioTrack: RemoteAudioTrack,
            RemoteAudioTrackPublication: RemoteAudioTrackPublication,
            RemoteDataTrack: RemoteDataTrack,
            RemoteDataTrackPublication: RemoteDataTrackPublication,
            RemoteVideoTrack: RemoteVideoTrack,
            RemoteVideoTrackPublication: RemoteVideoTrackPublication,
            tracks: []
        }, options);
        var indexed = indexTracksById(options.tracks);
        var log = options.log.createLog('default', _this);
        var audioTracks = new Map(indexed.audioTracks);
        var dataTracks = new Map(indexed.dataTracks);
        var tracks = new Map(indexed.tracks);
        var videoTracks = new Map(indexed.videoTracks);
        Object.defineProperties(_this, {
            _RemoteAudioTrack: {
                value: options.RemoteAudioTrack
            },
            _RemoteAudioTrackPublication: {
                value: options.RemoteAudioTrackPublication
            },
            _RemoteDataTrack: {
                value: options.RemoteDataTrack
            },
            _RemoteDataTrackPublication: {
                value: options.RemoteDataTrackPublication
            },
            _RemoteVideoTrack: {
                value: options.RemoteVideoTrack
            },
            _RemoteVideoTrackPublication: {
                value: options.RemoteVideoTrackPublication
            },
            _audioTracks: {
                value: audioTracks
            },
            _dataTracks: {
                value: dataTracks
            },
            _instanceId: {
                value: ++nInstances
            },
            _clientTrackSwitchOffControl: {
                value: options.clientTrackSwitchOffControl,
            },
            _contentPreferencesMode: {
                value: options.contentPreferencesMode,
            },
            _log: {
                value: log
            },
            _signaling: {
                value: signaling
            },
            _tracks: {
                value: tracks
            },
            _trackEventReemitters: {
                value: new Map()
            },
            _trackPublicationEventReemitters: {
                value: new Map()
            },
            _trackSignalingUpdatedEventCallbacks: {
                value: new Map()
            },
            _videoTracks: {
                value: videoTracks
            },
            audioTracks: {
                enumerable: true,
                value: new Map()
            },
            dataTracks: {
                enumerable: true,
                value: new Map()
            },
            identity: {
                enumerable: true,
                get: function () {
                    return signaling.identity;
                }
            },
            networkQualityLevel: {
                enumerable: true,
                get: function () {
                    return signaling.networkQualityLevel;
                }
            },
            networkQualityStats: {
                enumerable: true,
                get: function () {
                    return signaling.networkQualityStats;
                }
            },
            sid: {
                enumerable: true,
                get: function () {
                    return signaling.sid;
                }
            },
            state: {
                enumerable: true,
                get: function () {
                    return signaling.state;
                }
            },
            tracks: {
                enumerable: true,
                value: new Map()
            },
            videoTracks: {
                enumerable: true,
                value: new Map()
            }
        });
        _this._tracks.forEach(reemitTrackEvents.bind(null, _this));
        signaling.on('networkQualityLevelChanged', function () {
            return _this.emit('networkQualityLevelChanged', _this.networkQualityLevel, _this.networkQualityStats &&
                (_this.networkQualityStats.audio || _this.networkQualityStats.video)
                ? _this.networkQualityStats
                : null);
        });
        reemitSignalingStateChangedEvents(_this, signaling);
        log.info("Created a new Participant" + (_this.identity ? ": " + _this.identity : ''));
        return _this;
    }
    /**
     * Get the {@link RemoteTrack} events to re-emit.
     * @private
     * @returns {Array<Array<string>>} events
     */
    Participant.prototype._getTrackEvents = function () {
        return [
            ['dimensionsChanged', 'trackDimensionsChanged'],
            ['message', 'trackMessage'],
            ['started', 'trackStarted']
        ];
    };
    /**
     * @private
     */
    Participant.prototype._getTrackPublicationEvents = function () {
        return [];
    };
    Participant.prototype.toString = function () {
        return "[Participant #" + this._instanceId + ": " + this.sid + "]";
    };
    /**
     * @private
     * @param {RemoteTrack} track
     * @param {Track.ID} id
     * @returns {?RemoteTrack}
     */
    Participant.prototype._addTrack = function (track, id) {
        var log = this._log;
        if (this._tracks.has(id)) {
            return null;
        }
        this._tracks.set(id, track);
        var tracksByKind = {
            audio: this._audioTracks,
            video: this._videoTracks,
            data: this._dataTracks
        }[track.kind];
        tracksByKind.set(id, track);
        reemitTrackEvents(this, track, id);
        log.info("Added a new " + util.trackClass(track) + ":", id);
        log.debug(util.trackClass(track) + ":", track);
        return track;
    };
    /**
     * @private
     * @param {RemoteTrackPublication} publication
     * @returns {?RemoteTrackPublication}
     */
    Participant.prototype._addTrackPublication = function (publication) {
        var log = this._log;
        if (this.tracks.has(publication.trackSid)) {
            return null;
        }
        this.tracks.set(publication.trackSid, publication);
        var trackPublicationsByKind = {
            audio: this.audioTracks,
            data: this.dataTracks,
            video: this.videoTracks
        }[publication.kind];
        trackPublicationsByKind.set(publication.trackSid, publication);
        reemitTrackPublicationEvents(this, publication);
        log.info("Added a new " + util.trackPublicationClass(publication) + ":", publication.trackSid);
        log.debug(util.trackPublicationClass(publication) + ":", publication);
        return publication;
    };
    /**
     * @private
     */
    Participant.prototype._handleTrackSignalingEvents = function () {
        var _a = this, log = _a._log, clientTrackSwitchOffControl = _a._clientTrackSwitchOffControl, contentPreferencesMode = _a._contentPreferencesMode;
        var self = this;
        if (this.state === 'disconnected') {
            return;
        }
        var RemoteAudioTrack = this._RemoteAudioTrack;
        var RemoteAudioTrackPublication = this._RemoteAudioTrackPublication;
        var RemoteVideoTrack = this._RemoteVideoTrack;
        var RemoteVideoTrackPublication = this._RemoteVideoTrackPublication;
        var RemoteDataTrack = this._RemoteDataTrack;
        var RemoteDataTrackPublication = this._RemoteDataTrackPublication;
        var participantSignaling = this._signaling;
        function trackSignalingAdded(signaling) {
            var RemoteTrackPublication = {
                audio: RemoteAudioTrackPublication,
                data: RemoteDataTrackPublication,
                video: RemoteVideoTrackPublication
            }[signaling.kind];
            var publication = new RemoteTrackPublication(signaling, { log: log });
            self._addTrackPublication(publication);
            var isSubscribed = signaling.isSubscribed;
            if (isSubscribed) {
                trackSignalingSubscribed(signaling);
            }
            self._trackSignalingUpdatedEventCallbacks.set(signaling.sid, function () {
                if (isSubscribed !== signaling.isSubscribed) {
                    isSubscribed = signaling.isSubscribed;
                    if (isSubscribed) {
                        trackSignalingSubscribed(signaling);
                        return;
                    }
                    trackSignalingUnsubscribed(signaling);
                }
            });
            signaling.on('updated', self._trackSignalingUpdatedEventCallbacks.get(signaling.sid));
        }
        function trackSignalingRemoved(signaling) {
            if (signaling.isSubscribed) {
                signaling.setTrackTransceiver(null);
            }
            var updated = self._trackSignalingUpdatedEventCallbacks.get(signaling.sid);
            if (updated) {
                signaling.removeListener('updated', updated);
                self._trackSignalingUpdatedEventCallbacks.delete(signaling.sid);
            }
            var publication = self.tracks.get(signaling.sid);
            if (publication) {
                self._removeTrackPublication(publication);
            }
        }
        function trackSignalingSubscribed(signaling) {
            var isEnabled = signaling.isEnabled, name = signaling.name, kind = signaling.kind, sid = signaling.sid, trackTransceiver = signaling.trackTransceiver, isSwitchedOff = signaling.isSwitchedOff;
            var RemoteTrack = {
                audio: RemoteAudioTrack,
                video: RemoteVideoTrack,
                data: RemoteDataTrack
            }[kind];
            var publication = self.tracks.get(sid);
            // NOTE(mroberts): It should never be the case that the TrackSignaling and
            // MediaStreamTrack or DataTrackReceiver kinds disagree; however, just in
            // case, we handle it here.
            if (!RemoteTrack || kind !== trackTransceiver.kind) {
                return;
            }
            var options = { log: log, name: name, clientTrackSwitchOffControl: clientTrackSwitchOffControl, contentPreferencesMode: contentPreferencesMode };
            var setPriority = function (newPriority) { return participantSignaling.updateSubscriberTrackPriority(sid, newPriority); };
            var setRenderHint = function (renderHint) {
                if (signaling.isSubscribed) {
                    participantSignaling.updateTrackRenderHint(sid, renderHint);
                }
            };
            var track = kind === 'data'
                ? new RemoteTrack(sid, trackTransceiver, options)
                : new RemoteTrack(sid, trackTransceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options);
            self._addTrack(track, publication, trackTransceiver.id);
        }
        function trackSignalingUnsubscribed(signaling) {
            var _a = __read(Array.from(self._tracks.entries()).find(function (_a) {
                var _b = __read(_a, 2), track = _b[1];
                return track.sid === signaling.sid;
            }), 2), id = _a[0], track = _a[1];
            var publication = self.tracks.get(signaling.sid);
            if (track) {
                self._removeTrack(track, publication, id);
            }
        }
        participantSignaling.on('trackAdded', trackSignalingAdded);
        participantSignaling.on('trackRemoved', trackSignalingRemoved);
        participantSignaling.tracks.forEach(trackSignalingAdded);
        participantSignaling.on('stateChanged', function stateChanged(state) {
            if (state === 'disconnected') {
                log.debug('Removing event listeners');
                participantSignaling.removeListener('stateChanged', stateChanged);
                participantSignaling.removeListener('trackAdded', trackSignalingAdded);
                participantSignaling.removeListener('trackRemoved', trackSignalingRemoved);
            }
            else if (state === 'connected') {
                // NOTE(mmalavalli): Any transition to "connected" here is a result of
                // successful signaling reconnection, and not a first-time establishment
                // of the signaling connection.
                log.info('reconnected');
                // NOTE(mpatwardhan): `stateChanged` can get emitted with StateMachine locked.
                // Do not signal  public events synchronously with lock held.
                setTimeout(function () { return self.emit('reconnected'); }, 0);
            }
        });
    };
    /**
     * @private
     * @param {RemoteTrack} track
     * @param {Track.ID} id
     * @returns {?RemoteTrack}
     */
    Participant.prototype._removeTrack = function (track, id) {
        if (!this._tracks.has(id)) {
            return null;
        }
        this._tracks.delete(id);
        var tracksByKind = {
            audio: this._audioTracks,
            video: this._videoTracks,
            data: this._dataTracks
        }[track.kind];
        tracksByKind.delete(id);
        var reemitters = this._trackEventReemitters.get(id) || new Map();
        reemitters.forEach(function (reemitter, event) {
            track.removeListener(event, reemitter);
        });
        var log = this._log;
        log.info("Removed a " + util.trackClass(track) + ":", id);
        log.debug(util.trackClass(track) + ":", track);
        return track;
    };
    /**
     * @private
     * @param {RemoteTrackPublication} publication
     * @returns {?RemoteTrackPublication}
     */
    Participant.prototype._removeTrackPublication = function (publication) {
        publication = this.tracks.get(publication.trackSid);
        if (!publication) {
            return null;
        }
        this.tracks.delete(publication.trackSid);
        var trackPublicationsByKind = {
            audio: this.audioTracks,
            data: this.dataTracks,
            video: this.videoTracks
        }[publication.kind];
        trackPublicationsByKind.delete(publication.trackSid);
        var reemitters = this._trackPublicationEventReemitters.get(publication.trackSid) || new Map();
        reemitters.forEach(function (reemitter, event) {
            publication.removeListener(event, reemitter);
        });
        var log = this._log;
        log.info("Removed a " + util.trackPublicationClass(publication) + ":", publication.trackSid);
        log.debug(util.trackPublicationClass(publication) + ":", publication);
        return publication;
    };
    Participant.prototype.toJSON = function () {
        return util.valueToJSON(this);
    };
    return Participant;
}(EventEmitter));
/**
 * A {@link Participant.SID} is a 34-character string starting with "PA"
 * that uniquely identifies a {@link Participant}.
 * @type string
 * @typedef Participant.SID
 */
/**
 * A {@link Participant.Identity} is a string that identifies a
 * {@link Participant}. You can think of it like a name.
 * @typedef {string} Participant.Identity
 */
/**
 * The {@link Participant} has disconnected.
 * @param {Participant} participant - The {@link Participant} that disconnected.
 * @event Participant#disconnected
 */
/**
 * The {@link Participant}'s {@link NetworkQualityLevel} changed.
 * @param {NetworkQualityLevel} networkQualityLevel - The new
 *   {@link NetworkQualityLevel}
 * @param {?NetworkQualityStats} networkQualityStats - The {@link NetworkQualityStats}
 *   based on which {@link NetworkQualityLevel} is calculated, if any
 * @event Participant#networkQualityLevelChanged
 */
/**
 * The {@link Participant} has reconnected to the {@link Room} after a signaling connection disruption.
 * @event Participant#reconnected
 */
/**
 * The {@link Participant} is reconnecting to the {@link Room} after a signaling connection disruption.
 * @event Participant#reconnecting
 */
/**
 * One of the {@link Participant}'s {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event Participant#trackDimensionsChanged
 */
/**
 * One of the {@link Participant}'s {@link Track}s started.
 * @param {Track} track - The {@link Track} that started
 * @event Participant#trackStarted
 */
/**
 * Indexed {@link Track}s by {@link Track.ID}.
 * @typedef {object} IndexedTracks
 * @property {Array<{0: Track.ID, 1: AudioTrack}>} audioTracks - Indexed
 *   {@link AudioTrack}s
 * @property {Array<{0: Track.ID, 1: DataTrack}>} dataTracks - Indexed
 *   {@link DataTrack}s
 * @property {Array<{0: Track.ID, 1: Track}>} tracks - Indexed {@link Track}s
 * @property {Array<{0: Track.ID, 1: VideoTrack}>} videoTracks - Indexed
 *   {@link VideoTrack}s
 * @private
 */
/**
 * Index tracks by {@link Track.ID}.
 * @param {Array<Track>} tracks
 * @returns {IndexedTracks}
 * @private
 */
function indexTracksById(tracks) {
    var indexedTracks = tracks.map(function (track) { return [track.id, track]; });
    var indexedAudioTracks = indexedTracks.filter(function (keyValue) { return keyValue[1].kind === 'audio'; });
    var indexedVideoTracks = indexedTracks.filter(function (keyValue) { return keyValue[1].kind === 'video'; });
    var indexedDataTracks = indexedTracks.filter(function (keyValue) { return keyValue[1].kind === 'data'; });
    return {
        audioTracks: indexedAudioTracks,
        dataTracks: indexedDataTracks,
        tracks: indexedTracks,
        videoTracks: indexedVideoTracks
    };
}
/**
 * Re-emit {@link ParticipantSignaling} 'stateChanged' events.
 * @param {Participant} participant
 * @param {ParticipantSignaling} signaling
 * @private
 */
function reemitSignalingStateChangedEvents(participant, signaling) {
    var log = participant._log;
    if (participant.state === 'disconnected') {
        return;
    }
    // Reemit state transition events from the ParticipantSignaling.
    signaling.on('stateChanged', function stateChanged(state) {
        log.debug('Transitioned to state:', state);
        participant.emit(state, participant);
        if (state === 'disconnected') {
            log.debug('Removing Track event reemitters');
            signaling.removeListener('stateChanged', stateChanged);
            participant._tracks.forEach(function (track) {
                var reemitters = participant._trackEventReemitters.get(track.id);
                if (track && reemitters) {
                    reemitters.forEach(function (reemitter, event) {
                        track.removeListener(event, reemitter);
                    });
                }
            });
            // eslint-disable-next-line no-warning-comments
            // TODO(joma): Removing this introduced unit test failures in the RemoteParticipant.
            // Investigate further before removing.
            signaling.tracks.forEach(function (trackSignaling) {
                var track = participant._tracks.get(trackSignaling.id);
                var reemitters = participant._trackEventReemitters.get(trackSignaling.id);
                if (track && reemitters) {
                    reemitters.forEach(function (reemitter, event) {
                        track.removeListener(event, reemitter);
                    });
                }
            });
            participant._trackEventReemitters.clear();
            participant.tracks.forEach(function (publication) {
                participant._trackPublicationEventReemitters.get(publication.trackSid)
                    .forEach(function (reemitter, event) {
                    publication.removeListener(event, reemitter);
                });
            });
            participant._trackPublicationEventReemitters.clear();
        }
    });
}
/**
 * Re-emit {@link Track} events.
 * @param {Participant} participant
 * @param {Track} track
 * @param {Track.ID} id
 * @private
 */
function reemitTrackEvents(participant, track, id) {
    var trackEventReemitters = new Map();
    if (participant.state === 'disconnected') {
        return;
    }
    participant._getTrackEvents().forEach(function (eventPair) {
        var trackEvent = eventPair[0];
        var participantEvent = eventPair[1];
        trackEventReemitters.set(trackEvent, function () {
            var args = [participantEvent].concat([].slice.call(arguments));
            return participant.emit.apply(participant, __spreadArray([], __read(args)));
        });
        track.on(trackEvent, trackEventReemitters.get(trackEvent));
    });
    participant._trackEventReemitters.set(id, trackEventReemitters);
}
/**
 * Re-emit {@link TrackPublication} events.
 * @private
 * @param {Participant} participant
 * @param {TrackPublication} publication
 */
function reemitTrackPublicationEvents(participant, publication) {
    var publicationEventReemitters = new Map();
    if (participant.state === 'disconnected') {
        return;
    }
    participant._getTrackPublicationEvents().forEach(function (_a) {
        var _b = __read(_a, 2), publicationEvent = _b[0], participantEvent = _b[1];
        publicationEventReemitters.set(publicationEvent, function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            participant.emit.apply(participant, __spreadArray(__spreadArray([participantEvent], __read(args)), [publication]));
        });
        publication.on(publicationEvent, publicationEventReemitters.get(publicationEvent));
    });
    participant._trackPublicationEventReemitters.set(publication.trackSid, publicationEventReemitters);
}
module.exports = Participant;
//# sourceMappingURL=participant.js.map