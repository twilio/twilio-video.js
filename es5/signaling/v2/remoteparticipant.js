'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var RemoteParticipantSignaling = require('../remoteparticipant');
var RemoteTrackPublicationV2 = require('./remotetrackpublication');

/**
 * @extends RemoteParticipantSignaling
 * @property {?number} revision
 */

var RemoteParticipantV2 = function (_RemoteParticipantSig) {
  _inherits(RemoteParticipantV2, _RemoteParticipantSig);

  /**
   * Construct a {@link RemoteParticipantV2}.
   * @param {object} participantState
   * @param {function(string): Promise<DataTrackReceiver|MediaTrackReceiver>} getTrackReceiver
   * @param {object} [options]
   */
  function RemoteParticipantV2(participantState, getTrackReceiver, options) {
    var _ret;

    _classCallCheck(this, RemoteParticipantV2);

    var _this = _possibleConstructorReturn(this, (RemoteParticipantV2.__proto__ || Object.getPrototypeOf(RemoteParticipantV2)).call(this, participantState.sid, participantState.identity));

    options = Object.assign({
      RemoteTrackPublicationV2: RemoteTrackPublicationV2
    }, options);

    Object.defineProperties(_this, {
      _revision: {
        writable: true,
        value: null
      },
      _RemoteTrackPublicationV2: {
        value: options.RemoteTrackPublicationV2
      },
      _getTrackReceiver: {
        value: getTrackReceiver
      },
      revision: {
        enumerable: true,
        get: function get() {
          return this._revision;
        }
      }
    });

    return _ret = _this.update(participantState), _possibleConstructorReturn(_this, _ret);
  }

  /**
   * @private
   */


  _createClass(RemoteParticipantV2, [{
    key: '_getOrCreateTrack',
    value: function _getOrCreateTrack(trackState) {
      var RemoteTrackPublicationV2 = this._RemoteTrackPublicationV2;
      var track = this.tracks.get(trackState.id);
      if (!track) {
        track = new RemoteTrackPublicationV2(trackState);
        this.addTrack(track);
      }
      return track;
    }

    /**
     * Update the {@link RemoteParticipantV2} with the new state.
     * @param {object} participantState
     * @returns {this}
     */

  }, {
    key: 'update',
    value: function update(participantState) {
      if (this.revision !== null && participantState.revision <= this.revision) {
        return this;
      }
      this._revision = participantState.revision;

      var tracksToKeep = new Set();

      participantState.tracks.forEach(function (trackState) {
        var track = this._getOrCreateTrack(trackState);
        track.update(trackState);
        tracksToKeep.add(track);
      }, this);

      this.tracks.forEach(function (track) {
        if (!tracksToKeep.has(track)) {
          this.removeTrack(track);
        }
      }, this);

      if (participantState.state === 'disconnected' && this.state === 'connected') {
        this.preempt('disconnected');
      }

      return this;
    }

    /**
     * Add the {@link RemoteTrackPublicationV2} to the {@link RemoteParticipantV2}.
     * @param {RemoteTrackPublicationV2} track
     * @returns {this}
     */

  }, {
    key: 'addTrack',
    value: function addTrack(track) {
      _get(RemoteParticipantV2.prototype.__proto__ || Object.getPrototypeOf(RemoteParticipantV2.prototype), 'addTrack', this).call(this, track);
      this._getTrackReceiver(track.id).then(track.setTrackTransceiver.bind(track));
      return this;
    }
  }]);

  return RemoteParticipantV2;
}(RemoteParticipantSignaling);

module.exports = RemoteParticipantV2;