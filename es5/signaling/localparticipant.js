'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var ParticipantSignaling = require('./participant');

var LocalParticipantSignaling = function (_ParticipantSignaling) {
  _inherits(LocalParticipantSignaling, _ParticipantSignaling);

  function LocalParticipantSignaling() {
    _classCallCheck(this, LocalParticipantSignaling);

    var _this = _possibleConstructorReturn(this, (LocalParticipantSignaling.__proto__ || Object.getPrototypeOf(LocalParticipantSignaling)).call(this));

    Object.defineProperties(_this, {
      _publicationsToTrackSenders: {
        value: new Map()
      },
      _trackSendersToPublications: {
        value: new Map()
      }
    });
    return _this;
  }

  /**
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @param {string} name
   * @param {Track.Priority} priority
   * @returns {LocalTrackPublicationSignaling} publication
   */


  _createClass(LocalParticipantSignaling, [{
    key: 'addTrack',
    value: function addTrack(trackSender, name, priority) {
      var publication = this._createLocalTrackPublicationSignaling(trackSender, name, priority);
      this._trackSendersToPublications.set(trackSender, publication);
      this._publicationsToTrackSenders.set(publication, trackSender);
      _get(LocalParticipantSignaling.prototype.__proto__ || Object.getPrototypeOf(LocalParticipantSignaling.prototype), 'addTrack', this).call(this, publication);
      return this;
    }

    /**
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @returns {?LocalTrackPublicationSignaling}
     */

  }, {
    key: 'getPublication',
    value: function getPublication(trackSender) {
      return this._trackSendersToPublications.get(trackSender) || null;
    }

    /**
     * @param {LocalTrackPublicationSignaling} trackPublication
     * @returns {?DataTrackSender|MediaTrackSender}
     */

  }, {
    key: 'getSender',
    value: function getSender(trackPublication) {
      return this._publicationsToTrackSenders.get(trackPublication) || null;
    }

    /**
     * @param {DataTrackSender|MediaTrackSender} trackSender
     * @returns {?LocalTrackPublicationSignaling}
     */

  }, {
    key: 'removeTrack',
    value: function removeTrack(trackSender) {
      var publication = this._trackSendersToPublications.get(trackSender);
      if (!publication) {
        return null;
      }
      this._trackSendersToPublications.delete(trackSender);
      this._publicationsToTrackSenders.delete(publication);
      var didDelete = _get(LocalParticipantSignaling.prototype.__proto__ || Object.getPrototypeOf(LocalParticipantSignaling.prototype), 'removeTrack', this).call(this, publication);
      if (didDelete) {
        publication.stop();
      }
      return publication;
    }
  }]);

  return LocalParticipantSignaling;
}(ParticipantSignaling);

module.exports = LocalParticipantSignaling;