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
var Participant = require('./participant');
/**
 * A {@link RemoteParticipant} represents a remote {@link Participant} in a
 * {@link Room}.
 * @extends Participant
 * @property {Map<Track.SID, RemoteAudioTrackPublication>} audioTracks -
 *    The {@link Participant}'s {@link RemoteAudioTrackPublication}s
 * @property {Map<Track.SID, RemoteDataTrackPublication>} dataTracks -
 *    The {@link Participant}'s {@link RemoteDataTrackPublication}s
 * @property {Map<Track.SID, RemoteTrackPublication>} tracks -
 *    The {@link Participant}'s {@link RemoteTrackPublication}s
 * @property {Map<Track.SID, RemoteVideoTrackPublication>} videoTracks -
 *    The {@link Participant}'s {@link RemoteVideoTrackPublication}s
 * @emits RemoteParticipant#reconnected
 * @emits RemoteParticipant#reconnecting
 * @emits RemoteParticipant#trackDimensionsChanged
 * @emits RemoteParticipant#trackDisabled
 * @emits RemoteParticipant#trackEnabled
 * @emits RemoteParticipant#trackMessage
 * @emits RemoteParticipant#trackPublished
 * @emits RemoteParticipant#trackPublishPriorityChanged
 * @emits RemoteParticipant#trackStarted
 * @emits RemoteParticipant#trackSubscribed
 * @emits RemoteParticipant#trackSubscriptionFailed
 * @emits RemoteParticipant#trackSwitchedOff
 * @emits RemoteParticipant#trackSwitchedOn
 * @emits RemoteParticipant#trackUnpublished
 * @emits RemoteParticipant#trackUnsubscribed
 */
var RemoteParticipant = /** @class */ (function (_super) {
    __extends(RemoteParticipant, _super);
    /**
     * Construct a {@link RemoteParticipant}.
     * @param {ParticipantSignaling} signaling
     * @param {object} [options]
     */
    function RemoteParticipant(signaling, options) {
        var _this = _super.call(this, signaling, options) || this;
        _this._handleTrackSignalingEvents();
        _this.once('disconnected', _this._unsubscribeTracks.bind(_this));
        return _this;
    }
    RemoteParticipant.prototype.toString = function () {
        return "[RemoteParticipant #" + this._instanceId + (this.sid ? ": " + this.sid : '') + "]";
    };
    /**
     * @private
     * @param {RemoteTrack} remoteTrack
     * @param {RemoteTrackPublication} publication
     * @param {Track.ID} id
     * @returns {?RemoteTrack}
     */
    RemoteParticipant.prototype._addTrack = function (remoteTrack, publication, id) {
        if (!_super.prototype._addTrack.call(this, remoteTrack, id)) {
            return null;
        }
        publication._subscribed(remoteTrack);
        this.emit('trackSubscribed', remoteTrack, publication);
        return remoteTrack;
    };
    /**
     * @private
     * @param {RemoteTrackPublication} publication
     * @returns {?RemoteTrackPublication}
     */
    RemoteParticipant.prototype._addTrackPublication = function (publication) {
        var addedPublication = _super.prototype._addTrackPublication.call(this, publication);
        if (!addedPublication) {
            return null;
        }
        this.emit('trackPublished', addedPublication);
        return addedPublication;
    };
    /**
     * @private
     */
    RemoteParticipant.prototype._getTrackPublicationEvents = function () {
        return __spreadArray(__spreadArray([], __read(_super.prototype._getTrackPublicationEvents.call(this))), [
            ['subscriptionFailed', 'trackSubscriptionFailed'],
            ['trackDisabled', 'trackDisabled'],
            ['trackEnabled', 'trackEnabled'],
            ['publishPriorityChanged', 'trackPublishPriorityChanged'],
            ['trackSwitchedOff', 'trackSwitchedOff'],
            ['trackSwitchedOn', 'trackSwitchedOn']
        ]);
    };
    /**
     * @private
     */
    RemoteParticipant.prototype._unsubscribeTracks = function () {
        var _this = this;
        this.tracks.forEach(function (publication) {
            if (publication.isSubscribed) {
                var track = publication.track;
                publication._unsubscribe();
                _this.emit('trackUnsubscribed', track, publication);
            }
        });
    };
    /**
     * @private
     * @param {RemoteTrack} remoteTrack
     * @param {RemoteTrackPublication} publication
     * @param {Track.ID} id
     * @returns {?RemoteTrack}
     */
    RemoteParticipant.prototype._removeTrack = function (remoteTrack, publication, id) {
        var unsubscribedTrack = this._tracks.get(id);
        if (!unsubscribedTrack) {
            return null;
        }
        _super.prototype._removeTrack.call(this, unsubscribedTrack, id);
        publication._unsubscribe();
        this.emit('trackUnsubscribed', unsubscribedTrack, publication);
        return unsubscribedTrack;
    };
    /**
     * @private
     * @param {RemoteTrackPublication} publication
     * @returns {?RemoteTrackPublication}
     */
    RemoteParticipant.prototype._removeTrackPublication = function (publication) {
        this._signaling.clearTrackHint(publication.trackSid);
        var removedPublication = _super.prototype._removeTrackPublication.call(this, publication);
        if (!removedPublication) {
            return null;
        }
        this.emit('trackUnpublished', removedPublication);
        return removedPublication;
    };
    return RemoteParticipant;
}(Participant));
/**
 * The {@link RemoteParticipant} has reconnected to the {@link Room} after a signaling connection disruption.
 * @event RemoteParticipant#reconnected
 */
/**
 * The {@link RemoteParticipant} is reconnecting to the {@link Room} after a signaling connection disruption.
 * @event RemoteParticipant#reconnecting
 */
/**
 * One of the {@link RemoteParticipant}'s {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose dimensions changed
 * @event RemoteParticipant#trackDimensionsChanged
 */
/**
 * A {@link RemoteTrack} was disabled by the {@link RemoteParticipant}.
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication} associated with the disabled {@link RemoteTrack}
 * @event RemoteParticipant#trackDisabled
 */
/**
 * A {@link RemoteTrack} was enabled by the {@link RemoteParticipant}.
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication} associated with the enabled {@link RemoteTrack}
 * @event RemoteParticipant#trackEnabled
 */
/**
 * A message was received over one of the {@link RemoteParticipant}'s
 * {@link RemoteDataTrack}s.
 * @event RemoteParticipant#trackMessage
 * @param {string|ArrayBuffer} data
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} over which the
 *   message was received
 */
/**
 * A {@link RemoteTrack} was published by the {@link RemoteParticipant} after
 * connecting to the {@link Room}. This event is not emitted for
 * {@link RemoteTrack}s that were published while the {@link RemoteParticipant}
 * was connecting to the {@link Room}.
 * @event RemoteParticipant#trackPublished
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   which represents the published {@link RemoteTrack}
 * @example
 * function trackPublished(publication) {
 *   console.log(`Track ${publication.trackSid} was published`);
 * }
 *
 * room.on('participantConnected', participant => {
 *   // Handle RemoteTracks published while connecting to the Room.
 *   participant.trackPublications.forEach(trackPublished);
 *
 *   // Handle RemoteTracks published after connecting to the Room.
 *   participant.on('trackPublished', trackPublished);
 * });
 */
/**
 * One of the {@link RemoteParticipant}'s {@link RemoteTrack}s started.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that started
 * @event RemoteParticipant#trackStarted
 */
/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was subscribed to.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was subscribed to
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was subscribed to
 * @event RemoteParticipant#trackSubscribed
 */
/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} could not be subscribed to.
 * @param {TwilioError} error - The reason the {@link RemoteTrack} could not be
 *   subscribed to
 * @param {RemoteTrackPublication} publication - The
 *   {@link RemoteTrackPublication} for the {@link RemoteTrack} that could not
 *   be subscribed to
 * @event RemoteParticipant#trackSubscriptionFailed
 */
/**
 * The {@link RemoteTrackPublication}'s publish {@link Track.Priority} was changed by the
 * {@link RemoteParticipant}.
 * @param {Track.Priority} priority - the {@link RemoteTrack}'s new publish
 *   {@link Track.Priority};
 * @param {RemoteTrackPublication} publication - The
 *   {@link RemoteTrackPublication} for the {@link RemoteTrack} that changed priority
 * @event RemoteParticipant#trackPublishPriorityChanged
 */
/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was subscribed to.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was switched off
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was switched off
 * @event RemoteParticipant#trackSwitchedOff
 */
/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was switched on.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was switched on.
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was switched on
 * @event RemoteParticipant#trackSwitchedOn
 */
/**
 * A {@link RemoteTrack} was unpublished by the {@link RemoteParticipant}.
 * @event RemoteParticipant#trackUnpublished
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   which represents the unpublished {@link RemoteTrack}
 */
/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was unsubscribed from.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was unsubscribed from
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   for the {@link RemoteTrack} that was unsubscribed from
 * @event RemoteParticipant#trackUnsubscribed
 */
module.exports = RemoteParticipant;
//# sourceMappingURL=remoteparticipant.js.map