'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Participant = require('./participant');

/**
 * A {@link RemoteParticipant} represents a remote {@link Participant} in a
 * {@link Room}.
 * @extends Participant
 * @property {Map<Track.SID, RemoteAudioTrack>} audioTracks -
 *    The {@link Participant}'s {@link RemoteAudioTrack}s.
 * @property {Map<Track.SID, RemoteDataTrack>} dataTracks -
 *    The {@link Participant}'s {@link RemoteDataTrack}s.
 * @property {Map<Track.SID, RemoteTrack>} tracks -
 *    The {@link Participant}'s {@link RemoteTrack}s
 * @property {Map<Track.SID, RemoteVideoTrack>} videoTracks -
 *    The {@link Participant}'s {@link RemoteVideoTrack}s.
 * @emits RemoteParticipant#trackAdded
 * @emits RemoteParticipant#trackDimensionsChanged
 * @emits RemoteParticipant#trackDisabled
 * @emits RemoteParticipant#trackEnabled
 * @emits RemoteParticipant#trackMessage
 * @emits RemoteParticipant#trackRemoved
 * @emits RemoteParticipant#trackStarted
 * @emits RemoteParticipant#trackSubscribed
 * @emits RemoteParticipant#trackSubscriptionFailed
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
     */

  }, {
    key: '_addTrack',
    value: function _addTrack(remoteTrack) {
      if (!_get(RemoteParticipant.prototype.__proto__ || Object.getPrototypeOf(RemoteParticipant.prototype), '_addTrack', this).call(this, remoteTrack)) {
        return null;
      }
      this.emit('trackSubscribed', remoteTrack);
      return remoteTrack;
    }

    /**
     * @private
     */

  }, {
    key: '_unsubscribeTracks',
    value: function _unsubscribeTracks() {
      var tracks = Array.from(this.tracks.values());
      tracks.forEach(this._unsubscribeTrack, this);
    }

    /**
     * @private
     */

  }, {
    key: '_unsubscribeTrack',
    value: function _unsubscribeTrack(remoteTrack) {
      var unsubscribedTrack = this.tracks.get(remoteTrack.id);
      if (unsubscribedTrack) {
        unsubscribedTrack._unsubscribe();
        this.emit('trackUnsubscribed', unsubscribedTrack);
      }
    }

    /**
     * @private
     */

  }, {
    key: '_removeTrack',
    value: function _removeTrack(remoteTrack) {
      var unsubscribedTrack = this.tracks.get(remoteTrack.id);
      if (!unsubscribedTrack) {
        return null;
      }

      this._deleteTrack(unsubscribedTrack);
      unsubscribedTrack._unsubscribe();
      this.emit('trackUnsubscribed', unsubscribedTrack);
      this.emit('trackRemoved', unsubscribedTrack);

      return unsubscribedTrack;
    }
  }]);

  return RemoteParticipant;
}(Participant);

/**
 * A {@link RemoteTrack} was added by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was added
 * @event RemoteParticipant#trackAdded
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
 * A {@link RemoteTrack} was removed by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was removed
 * @event RemoteParticipant#trackRemoved
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
 * @event RemoteParticipant#trackSubscriptionFailed
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was unsubscribed from.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was unsubscribed from
 * @event RemoteParticipant#trackUnsubscribed
 */

module.exports = RemoteParticipant;