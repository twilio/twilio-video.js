'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Participant = require('./participant');

var _require = require('./util'),
    deprecateEvents = _require.deprecateEvents;

/**
 * A {@link RemoteParticipant} represents a remote {@link Participant} in a
 * {@link Room}.
 * @extends Participant
 * @property {Map<Track.SID, RemoteAudioTrack>} audioTracks -
 *    The {@link Participant}'s {@link RemoteAudioTrack}s
 * @property {Map<Track.SID, RemoteAudioTrackPublication>} audioTrackPublications -
 *    The {@link Participant}'s {@link RemoteAudioTrackPublication}s
 * @property {Map<Track.SID, RemoteDataTrack>} dataTracks -
 *    The {@link Participant}'s {@link RemoteDataTrack}s
 * @property {Map<Track.SID, RemoteDataTrackPublication>} dataTrackPublications -
 *    The {@link Participant}'s {@link RemoteDataTrackPublication}s
 * @property {Map<Track.SID, RemoteTrack>} tracks -
 *    The {@link Participant}'s {@link RemoteTrack}s
 * @property {Map<Track.SID, RemoteTrackPublication>} trackPublications -
 *    The {@link Participant}'s {@link RemoteTrackPublication}s
 * @property {Map<Track.SID, RemoteVideoTrack>} videoTracks -
 *    The {@link Participant}'s {@link RemoteVideoTrack}s
 * @property {Map<Track.SID, RemoteVideoTrackPublication>} videoTrackPublications -
 *    The {@link Participant}'s {@link RemoteVideoTrackPublication}s
 * @emits RemoteParticipant#trackAdded
 * @emits RemoteParticipant#trackDimensionsChanged
 * @emits RemoteParticipant#trackDisabled
 * @emits RemoteParticipant#trackEnabled
 * @emits RemoteParticipant#trackMessage
 * @emits RemoteParticipant#trackPublished
 * @emits RemoteParticipant#trackRemoved
 * @emits RemoteParticipant#trackStarted
 * @emits RemoteParticipant#trackSubscribed
 * @emits RemoteParticipant#trackSubscriptionFailed
 * @emits RemoteParticipant#trackUnpublished
 * @emits RemoteParticipant#trackUnsubscribed
 */


var RemoteParticipant = function (_Participant) {
  _inherits(RemoteParticipant, _Participant);

  /**
   * Construct a {@link RemoteParticipant}.
   * @param {ParticipantSignaling} signaling
   * @param {object} [options]
   */
  function RemoteParticipant(signaling, options) {
    _classCallCheck(this, RemoteParticipant);

    var _this = _possibleConstructorReturn(this, (RemoteParticipant.__proto__ || Object.getPrototypeOf(RemoteParticipant)).call(this, signaling, options));

    deprecateEvents('RemoteParticipant', _this, new Map([['trackAdded', 'trackSubscribed'], ['trackRemoved', 'trackUnsubscribed']]), _this._log);

    _this._handleTrackSignalingEvents();
    _this.once('disconnected', _this._unsubscribeTracks.bind(_this));
    return _this;
  }

  _createClass(RemoteParticipant, [{
    key: 'toString',
    value: function toString() {
      return '[RemoteParticipant #' + this._instanceId + (this.sid ? ': ' + this.sid : '') + ']';
    }

    /**
     * @private
     * @param {RemoteTrack} remoteTrack
     * @param {RemoteTrackPublication} publication
     * @returns {?RemoteTrack}
     */

  }, {
    key: '_addTrack',
    value: function _addTrack(remoteTrack, publication) {
      remoteTrack._setSid(publication.trackSid);
      if (!_get(RemoteParticipant.prototype.__proto__ || Object.getPrototypeOf(RemoteParticipant.prototype), '_addTrack', this).call(this, remoteTrack)) {
        return null;
      }
      publication._subscribed(remoteTrack);
      this.emit('trackSubscribed', remoteTrack);
      return remoteTrack;
    }

    /**
     * @private
     * @param {RemoteTrackPublication} publication
     * @returns {?RemoteTrackPublication}
     */

  }, {
    key: '_addTrackPublication',
    value: function _addTrackPublication(publication) {
      var addedPublication = _get(RemoteParticipant.prototype.__proto__ || Object.getPrototypeOf(RemoteParticipant.prototype), '_addTrackPublication', this).call(this, publication);
      if (!addedPublication) {
        return null;
      }
      this.emit('trackPublished', addedPublication);
      return addedPublication;
    }
    /**
     * @private
     */

  }, {
    key: '_getTrackPublicationEvents',
    value: function _getTrackPublicationEvents() {
      return [].concat(_toConsumableArray(_get(RemoteParticipant.prototype.__proto__ || Object.getPrototypeOf(RemoteParticipant.prototype), '_getTrackPublicationEvents', this).call(this)), [['subscriptionFailed', 'trackSubscriptionFailed']]);
    }

    /**
     * @private
     */

  }, {
    key: '_unsubscribeTracks',
    value: function _unsubscribeTracks() {
      var _this2 = this;

      this.trackPublications.forEach(function (publication) {
        if (publication.isSubscribed) {
          var track = publication.track;
          publication._unsubscribe();
          _this2.emit('trackUnsubscribed', track);
        }
      });
    }

    /**
     * @private
     * @param {RemoteTrack} remoteTrack
     * @param {RemoteTrackPublication} publication
     * @returns {?RemoteTrack}
     */

  }, {
    key: '_removeTrack',
    value: function _removeTrack(remoteTrack, publication) {
      var unsubscribedTrack = this.tracks.get(remoteTrack._id);
      if (!unsubscribedTrack) {
        return null;
      }

      this._deleteTrack(unsubscribedTrack);
      publication._unsubscribe();
      this.emit('trackUnsubscribed', unsubscribedTrack);
      this.emit('trackRemoved', unsubscribedTrack);
      return unsubscribedTrack;
    }

    /**
     * @private
     * @param {RemoteTrackPublication} publication
     * @returns {?RemoteTrackPublication}
     */

  }, {
    key: '_removeTrackPublication',
    value: function _removeTrackPublication(publication) {
      var removedPublication = _get(RemoteParticipant.prototype.__proto__ || Object.getPrototypeOf(RemoteParticipant.prototype), '_removeTrackPublication', this).call(this, publication);
      if (!removedPublication) {
        return null;
      }
      this.emit('trackUnpublished', removedPublication);
      return removedPublication;
    }
  }]);

  return RemoteParticipant;
}(Participant);

/**
 * A {@link RemoteTrack} was added by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was added
 * @event RemoteParticipant#trackAdded
 * @deprecated Use {@link RemoteParticipant#trackSubscribed} instead
 */

/**
 * One of the {@link RemoteParticipant}'s {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose dimensions changed
 * @event RemoteParticipant#trackDimensionsChanged
 */

/**
 * A {@link RemoteTrack} was disabled by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was disabled
 * @event RemoteParticipant#trackDisabled
 */

/**
 * A {@link RemoteTrack} was enabled by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was enabled
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
 * A {@link RemoteTrack} was removed by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was removed
 * @event RemoteParticipant#trackRemoved
 * @deprecated Use {@link RemoteParticipant#trackUnsubscribed} instead
 */

/**
 * One of the {@link RemoteParticipant}'s {@link RemoteTrack}s started.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that started
 * @event RemoteParticipant#trackStarted
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was subscribed to.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was subscribed to
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
 * A {@link RemoteTrack} was unpublished by the {@link RemoteParticipant}.
 * @event RemoteParticipant#trackUnpublished
 * @param {RemoteTrackPublication} publication - The {@link RemoteTrackPublication}
 *   which represents the unpublished {@link RemoteTrack}
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was unsubscribed from.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was unsubscribed from
 * @event RemoteParticipant#trackUnsubscribed
 */

module.exports = RemoteParticipant;