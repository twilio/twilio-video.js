'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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
     * @param {Track.ID} id
     * @returns {?RemoteTrack}
     */

  }, {
    key: '_addTrack',
    value: function _addTrack(remoteTrack, publication, id) {
      if (!_get(RemoteParticipant.prototype.__proto__ || Object.getPrototypeOf(RemoteParticipant.prototype), '_addTrack', this).call(this, remoteTrack, id)) {
        return null;
      }
      publication._subscribed(remoteTrack);
      this.emit('trackSubscribed', remoteTrack, publication);
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
      return [].concat(_toConsumableArray(_get(RemoteParticipant.prototype.__proto__ || Object.getPrototypeOf(RemoteParticipant.prototype), '_getTrackPublicationEvents', this).call(this)), [['subscriptionFailed', 'trackSubscriptionFailed'], ['trackDisabled', 'trackDisabled'], ['trackEnabled', 'trackEnabled'], ['publishPriorityChanged', 'trackPublishPriorityChanged'], ['trackSwitchedOff', 'trackSwitchedOff'], ['trackSwitchedOn', 'trackSwitchedOn']]);
    }

    /**
     * @private
     */

  }, {
    key: '_unsubscribeTracks',
    value: function _unsubscribeTracks() {
      var _this2 = this;

      this.tracks.forEach(function (publication) {
        if (publication.isSubscribed) {
          var track = publication.track;
          publication._unsubscribe();
          _this2.emit('trackUnsubscribed', track, publication);
        }
      });
    }

    /**
     * @private
     * @param {RemoteTrack} remoteTrack
     * @param {RemoteTrackPublication} publication
     * @param {Track.ID} id
     * @returns {?RemoteTrack}
     */

  }, {
    key: '_removeTrack',
    value: function _removeTrack(remoteTrack, publication, id) {
      var unsubscribedTrack = this._tracks.get(id);
      if (!unsubscribedTrack) {
        return null;
      }

      _get(RemoteParticipant.prototype.__proto__ || Object.getPrototypeOf(RemoteParticipant.prototype), '_removeTrack', this).call(this, unsubscribedTrack, id);
      publication._unsubscribe();
      this.emit('trackUnsubscribed', unsubscribedTrack, publication);
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